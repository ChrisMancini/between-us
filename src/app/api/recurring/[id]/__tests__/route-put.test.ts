import {
  makeSession,
  asMock,
  makeJsonRequest,
  makeIdContext,
  makeParsedSuccess,
  makeParsedFailure,
  VALID_ID,
  VALID_ID_2,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/recurring-template", () => ({
  RecurringTemplate: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));
jest.mock("@/lib/models/tag", () => ({
  Tag: { find: jest.fn() },
}));
jest.mock("@/lib/validations/recurring-template", () => ({
  recurringTemplateApiSchema: { safeParse: jest.fn() },
}));

import { auth } from "@/auth";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { Tag } from "@/lib/models/tag";
import { recurringTemplateApiSchema } from "@/lib/validations/recurring-template";
import { PUT } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(recurringTemplateApiSchema.safeParse);

const validData = {
  name: "Monthly Bills",
  items: [
    {
      paidBy: "john",
      tagIds: [VALID_ID_2],
      amount: 10000,
      where: "FPL",
      notes: "Electric",
      splitType: "split",
      settlementType: "deferred",
    },
  ],
  autoApplyEnabled: false,
  schedule: null,
};

const existingTemplate = {
  _id: VALID_ID,
  name: "Monthly Bills",
  items: validData.items,
  autoApplyEnabled: false,
  autoApplyEnabledAt: null,
  schedule: null,
};

function mockFindOne(doc: unknown) {
  asMock(RecurringTemplate.findOne).mockReturnValue({
    lean: jest.fn().mockResolvedValue(doc),
  });
}

function putRequest() {
  return makeJsonRequest(`/api/recurring/${VALID_ID}`, {}, "PUT");
}

describe("PUT /api/recurring/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PUT(putRequest(), makeIdContext());
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid ObjectId", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await PUT(putRequest(), makeIdContext("not-an-id"));
    await expectError(res, 400, "Invalid ID");
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 400, "Validation failed");
  });

  it("returns 400 when tagId is invalid", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        ...validData,
        items: [{ ...validData.items[0], tagIds: ["bad"] }],
      })
    );
    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 400, "Invalid tag ID");
  });

  it("returns 422 when tags not found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 422, "One or more tags not found");
  });

  it("returns 404 when template not found or not owned", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID_2 }]),
    });
    mockFindOne(null);
    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 404, "Template not found");
  });

  it("returns 200 on success", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID_2 }]),
    });
    mockFindOne(existingTemplate);
    const updated = {
      _id: VALID_ID,
      name: "Monthly Bills",
      items: validData.items,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    asMock(RecurringTemplate.findOneAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue(updated),
    });

    const res = await PUT(putRequest(), makeIdContext());
    const body = await expectStatus(res, 200);
    expect(body.template.name).toBe("Monthly Bills");
  });

  it("stamps autoApplyEnabledAt on the off→on transition", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        ...validData,
        autoApplyEnabled: true,
        schedule: { type: "day_of_month", day: 10 },
      })
    );
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID_2 }]),
    });
    mockFindOne(existingTemplate);
    asMock(RecurringTemplate.findOneAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        ...existingTemplate,
        autoApplyEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });

    await PUT(putRequest(), makeIdContext());

    expect(RecurringTemplate.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: VALID_ID, createdBy: "user-1" },
      expect.objectContaining({
        autoApplyEnabled: true,
        autoApplyEnabledAt: expect.any(Date),
        schedule: { type: "day_of_month", day: 10 },
      }),
      { returnDocument: "after" }
    );
  });

  it("preserves autoApplyEnabledAt when already enabled", async () => {
    const enabledAt = new Date("2026-06-01T00:00:00.000Z");
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        ...validData,
        autoApplyEnabled: true,
        schedule: { type: "day_of_month", day: 10 },
      })
    );
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID_2 }]),
    });
    mockFindOne({
      ...existingTemplate,
      autoApplyEnabled: true,
      autoApplyEnabledAt: enabledAt,
      schedule: { type: "day_of_month", day: 10 },
    });
    asMock(RecurringTemplate.findOneAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        ...existingTemplate,
        autoApplyEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });

    await PUT(putRequest(), makeIdContext());

    expect(RecurringTemplate.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: VALID_ID, createdBy: "user-1" },
      expect.objectContaining({ autoApplyEnabledAt: enabledAt }),
      { returnDocument: "after" }
    );
  });

  it("re-stamps autoApplyEnabledAt when the schedule changes while enabled", async () => {
    // Switching family/params on an already-enabled template must re-anchor
    // catch-up so the new schedule never backfills its history (ADR-0018
    // decision 2a; story 12, #73).
    const enabledAt = new Date("2026-01-01T00:00:00.000Z");
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        ...validData,
        autoApplyEnabled: true,
        schedule: { type: "semi_monthly", days: [15, "last"] },
      })
    );
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID_2 }]),
    });
    mockFindOne({
      ...existingTemplate,
      autoApplyEnabled: true,
      autoApplyEnabledAt: enabledAt,
      schedule: { type: "day_of_month", day: 10 },
    });
    asMock(RecurringTemplate.findOneAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        ...existingTemplate,
        autoApplyEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });

    await PUT(putRequest(), makeIdContext());

    const updateArg = asMock(RecurringTemplate.findOneAndUpdate).mock
      .calls[0][1] as { autoApplyEnabledAt: Date };
    expect(updateArg.autoApplyEnabledAt).toBeInstanceOf(Date);
    expect(updateArg.autoApplyEnabledAt.getTime()).not.toBe(enabledAt.getTime());
  });
});
