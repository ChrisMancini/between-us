import { NextResponse } from "next/server";
import {
  makeSession,
  asMock,
  makeParsedSuccess,
  makeParsedFailure,
  makeJsonRequest,
  VALID_ID,
  VALID_ID_2,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/expense", () => ({
  Expense: { find: jest.fn(), create: jest.fn() },
}));
jest.mock("@/lib/models/tag", () => ({
  Tag: { find: jest.fn() },
}));
jest.mock("@/lib/tag-utils", () => ({
  serializeTag: (t: { _id: unknown; path: string; sortOrder: number }) => ({
    _id: String(t._id),
    path: t.path,
    sortOrder: t.sortOrder,
    name: t.path.split("/").pop(),
    parent: "",
    depth: 1,
  }),
}));
jest.mock("@/lib/validations/expense", () => ({
  expenseApiSchema: { safeParse: jest.fn() },
}));
jest.mock("@/lib/settlement-guard", () => ({ assertMonthsOpen: jest.fn() }));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));
jest.mock("@/lib/readiness-reset", () => ({ resetReadinessForMonths: jest.fn() }));

import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { expenseApiSchema } from "@/lib/validations/expense";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { logActivity } from "@/lib/activity-logger";
import { POST } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(expenseApiSchema.safeParse);
const mockAssertMonthsOpen = asMock(assertMonthsOpen);

const validData = {
  paidBy: "john",
  date: "2026-04-15",
  tagIds: [VALID_ID_2],
  amount: 5000,
  where: "Publix",
  notes: "Groceries",
  splitType: "split",
  settlementType: "deferred",
};

describe("POST /api/expenses", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/expenses", {}));
    await expectStatus(res, 401);
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await POST(makeJsonRequest("/api/expenses", {}));
    await expectError(res, 400, "Validation failed");
  });

  it("returns 400 when tagId is invalid", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ ...validData, tagIds: ["bad"] }));
    const res = await POST(makeJsonRequest("/api/expenses", {}));
    await expectError(res, 400, "Invalid tag ID");
  });

  it("returns 422 when month is settled", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    mockAssertMonthsOpen.mockResolvedValue(
      NextResponse.json({ error: "Settled" }, { status: 422 })
    );
    const res = await POST(makeJsonRequest("/api/expenses", {}));
    await expectStatus(res, 422);
  });

  it("returns 422 when tags not found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    mockAssertMonthsOpen.mockResolvedValue(null);
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    const res = await POST(makeJsonRequest("/api/expenses", {}));
    await expectError(res, 422, "One or more tags not found");
  });

  it("returns 201 on success", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    mockAssertMonthsOpen.mockResolvedValue(null);
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID_2, path: "Groceries" }]),
    });

    const created = {
      _id: VALID_ID,
      paidBy: "john",
      date: new Date(Date.UTC(2026, 3, 15)),
      amount: 5000,
      where: "Publix",
      notes: "Groceries",
      splitType: "split",
      settlementType: "deferred",
      populate: jest.fn().mockResolvedValue({
        _id: VALID_ID,
        paidBy: "john",
        date: new Date(Date.UTC(2026, 3, 15)),
        amount: 5000,
        where: "Publix",
        notes: "Groceries",
        splitType: "split",
        settlementType: "deferred",
        tags: [
          {
            _id: VALID_ID_2,
            path: "Groceries",
            sortOrder: 2,
          },
        ],
      }),
    };
    asMock(Expense.create).mockResolvedValue(created);

    const res = await POST(makeJsonRequest("/api/expenses", {}));
    const body = await expectStatus(res, 201);
    expect(body.expense.where).toBe("Publix");
    expect(body.expense.tags[0].path).toBe("Groceries");
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "expense_create",
      expect.stringContaining("Publix"),
      expect.objectContaining({ amount: 5000, where: "Publix" })
    );
  });
});
