import {
  makeSession,
  asMock,
  makeJsonRequest,
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
  RecurringTemplate: { find: jest.fn(), create: jest.fn() },
}));
jest.mock("@/lib/models/category", () => ({
  Category: { find: jest.fn() },
}));
jest.mock("@/lib/validations/recurring-template", () => ({
  recurringTemplateApiSchema: { safeParse: jest.fn() },
}));

import { auth } from "@/auth";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { Category } from "@/lib/models/category";
import { recurringTemplateApiSchema } from "@/lib/validations/recurring-template";
import { POST } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(recurringTemplateApiSchema.safeParse);

const validData = {
  name: "Monthly Bills",
  items: [
    {
      paidBy: "john",
      categoryId: VALID_ID_2,
      amount: 10000,
      where: "FPL",
      notes: "Electric",
      splitType: "split",
    },
  ],
};

describe("POST /api/recurring", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/recurring", {}));
    await expectStatus(res, 401);
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await POST(makeJsonRequest("/api/recurring", {}));
    await expectError(res, 400, "Validation failed");
  });

  it("returns 400 when categoryId is invalid", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        ...validData,
        items: [{ ...validData.items[0], categoryId: "bad" }],
      })
    );
    const res = await POST(makeJsonRequest("/api/recurring", {}));
    await expectError(res, 400, "Invalid category ID");
  });

  it("returns 422 when categories not found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(Category.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    const res = await POST(makeJsonRequest("/api/recurring", {}));
    await expectError(res, 422, "One or more categories not found");
  });

  it("returns 201 on success", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(Category.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID_2 }]),
    });
    const created = {
      _id: VALID_ID,
      name: "Monthly Bills",
      items: [
        {
          paidBy: "john",
          categoryId: VALID_ID_2,
          amount: 10000,
          where: "FPL",
          notes: "Electric",
          splitType: "split",
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    asMock(RecurringTemplate.create).mockResolvedValue(created);

    const res = await POST(makeJsonRequest("/api/recurring", {}));
    const body = await expectStatus(res, 201);
    expect(body.template.name).toBe("Monthly Bills");
  });
});
