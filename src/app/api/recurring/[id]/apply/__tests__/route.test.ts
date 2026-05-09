import { NextResponse } from "next/server";
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
  RecurringTemplate: { findOne: jest.fn() },
}));
jest.mock("@/lib/models/category", () => ({
  Category: { find: jest.fn() },
}));
jest.mock("@/lib/models/expense", () => ({
  Expense: { insertMany: jest.fn() },
}));
jest.mock("@/lib/validations/recurring-template", () => ({
  applyTemplateSchema: { safeParse: jest.fn() },
}));
jest.mock("@/lib/settlement-guard", () => ({ assertMonthsOpen: jest.fn() }));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));
jest.mock("@/lib/readiness-reset", () => ({ resetReadinessForMonths: jest.fn() }));

import { auth } from "@/auth";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { Category } from "@/lib/models/category";
import { Expense } from "@/lib/models/expense";
import { applyTemplateSchema } from "@/lib/validations/recurring-template";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { logActivity } from "@/lib/activity-logger";
import { POST } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(applyTemplateSchema.safeParse);
const mockAssertMonthsOpen = asMock(assertMonthsOpen);

const templateItems = [
  {
    paidBy: "john",
    categoryId: VALID_ID_2,
    amount: 10000,
    where: "FPL",
    notes: "Electric",
    splitType: "split",
  },
];

const validData = {
  date: "2026-04-15",
  items: [{ amount: 11000 }],
};

describe("POST /api/recurring/[id]/apply", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/recurring/apply", {}), makeIdContext());
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid ObjectId", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await POST(
      makeJsonRequest("/api/recurring/apply", {}),
      makeIdContext("not-an-id")
    );
    await expectError(res, 400, "Invalid ID");
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await POST(makeJsonRequest("/api/recurring/apply", {}), makeIdContext());
    await expectError(res, 400, "Validation failed");
  });

  it("returns 404 when template not found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(RecurringTemplate.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    const res = await POST(makeJsonRequest("/api/recurring/apply", {}), makeIdContext());
    await expectError(res, 404, "Template not found");
  });

  it("returns 400 when items count does not match", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ date: "2026-04-15", items: [{ amount: 1 }, { amount: 2 }] })
    );
    asMock(RecurringTemplate.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ items: templateItems }),
    });
    const res = await POST(makeJsonRequest("/api/recurring/apply", {}), makeIdContext());
    await expectError(res, 400, "Items count does not match");
  });

  it("returns 422 when month is settled", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(RecurringTemplate.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ items: templateItems }),
    });
    mockAssertMonthsOpen.mockResolvedValue(
      NextResponse.json({ error: "Settled" }, { status: 422 })
    );
    const res = await POST(makeJsonRequest("/api/recurring/apply", {}), makeIdContext());
    await expectStatus(res, 422);
  });

  it("returns 422 when categories no longer exist", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(RecurringTemplate.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ items: templateItems }),
    });
    mockAssertMonthsOpen.mockResolvedValue(null);
    asMock(Category.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    const res = await POST(makeJsonRequest("/api/recurring/apply", {}), makeIdContext());
    await expectError(res, 422, "no longer exist");
  });

  it("returns 201 on success", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(RecurringTemplate.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ items: templateItems }),
    });
    mockAssertMonthsOpen.mockResolvedValue(null);
    asMock(Category.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID_2 }]),
    });
    asMock(Expense.insertMany).mockResolvedValue([{ _id: VALID_ID }]);

    const res = await POST(makeJsonRequest("/api/recurring/apply", {}), makeIdContext());
    const body = await expectStatus(res, 201);
    expect(body.count).toBe(1);
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "recurring_apply",
      expect.stringContaining("applied"),
      expect.objectContaining({ count: 1 })
    );
  });
});
