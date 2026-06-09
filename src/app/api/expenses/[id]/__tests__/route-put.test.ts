import { NextResponse } from "next/server";
import {
  makeSession,
  makeAdminSession,
  asMock,
  makeJsonRequest,
  makeIdContext,
  makeParsedSuccess,
  makeParsedFailure,
  makeExpense,
  VALID_ID,
  VALID_ID_2,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/lib/action-lifecycle", () => ({
  handleExpenseChange: jest.fn().mockResolvedValue(undefined),
  handleExpenseDelete: jest.fn().mockResolvedValue(undefined),
  getOtherPersonKey: jest.fn().mockResolvedValue("jane"),
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/expense", () => ({
  Expense: { findById: jest.fn(), findByIdAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() },
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
jest.mock("@/lib/models/settlement", () => ({
  Settlement: { findOne: jest.fn() },
}));
jest.mock("@/lib/validations/expense", () => ({
  expenseUpdateApiSchema: { safeParse: jest.fn() },
}));
jest.mock("@/lib/settlement-guard", () => ({ assertMonthsOpen: jest.fn() }));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));
jest.mock("@/lib/readiness-reset", () => ({ resetReadinessForMonths: jest.fn() }));

import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { expenseUpdateApiSchema } from "@/lib/validations/expense";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { logActivity } from "@/lib/activity-logger";
import { PUT } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(expenseUpdateApiSchema.safeParse);
const mockAssertMonthsOpen = asMock(assertMonthsOpen);

const validData = {
  date: "2026-04-15",
  tagIds: [VALID_ID_2],
  amount: 6000,
  where: "Costco",
  notes: "Bulk",
  splitType: "split",
  settlementType: "deferred",
};

function putRequest() {
  return makeJsonRequest(`/api/expenses/${VALID_ID}`, {}, "PUT");
}

function mockPopulatedUpdate(overrides?: Record<string, unknown>) {
  const tags = [
    {
      _id: VALID_ID_2,
      path: "Groceries",
      sortOrder: 2,
    },
  ];
  return {
    populate: jest.fn().mockResolvedValue({
      _id: VALID_ID,
      paidBy: "john",
      date: new Date(Date.UTC(2026, 3, 15)),
      amount: 6000,
      where: "Costco",
      notes: "Bulk",
      splitType: "split",
      settlementType: "deferred",
      tags,
      ...overrides,
    }),
  };
}

describe("PUT /api/expenses/[id]", () => {
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
    mockSafeParse.mockReturnValue(makeParsedSuccess({ ...validData, tagIds: ["bad"] }));
    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 400, "Invalid tag ID");
  });

  it("returns 404 when expense not found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(Expense.findById).mockResolvedValue(null);
    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 404, "Expense not found");
  });

  it("returns 403 when user is not the owner", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(Expense.findById).mockResolvedValue(makeExpense({ paidBy: "jane" }));
    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 403, "Forbidden");
  });

  it("returns 422 when month is settled", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(Expense.findById).mockResolvedValue(makeExpense());
    mockAssertMonthsOpen.mockResolvedValue(
      NextResponse.json({ error: "Settled" }, { status: 422 })
    );
    const res = await PUT(putRequest(), makeIdContext());
    await expectStatus(res, 422);
  });

  it("returns 422 when tags not found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(Expense.findById).mockResolvedValue(makeExpense());
    mockAssertMonthsOpen.mockResolvedValue(null);
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 422, "One or more tags not found");
  });

  it("returns 200 on success for owner", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(Expense.findById).mockResolvedValue(makeExpense());
    mockAssertMonthsOpen.mockResolvedValue(null);
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID_2 }]),
    });
    asMock(Expense.findByIdAndUpdate).mockReturnValue(mockPopulatedUpdate());

    const res = await PUT(putRequest(), makeIdContext());
    const body = await expectStatus(res, 200);
    expect(body.expense.where).toBe("Costco");
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "expense_edit",
      expect.stringContaining("Costco"),
      expect.objectContaining({ expenseId: VALID_ID, amount: 6000 })
    );
  });

  it("returns 200 when admin edits another user's expense", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    asMock(Expense.findById).mockResolvedValue(makeExpense({ paidBy: "jane" }));
    mockAssertMonthsOpen.mockResolvedValue(null);
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID_2 }]),
    });
    asMock(Expense.findByIdAndUpdate).mockReturnValue(mockPopulatedUpdate());

    const res = await PUT(putRequest(), makeIdContext());
    await expectStatus(res, 200);
  });
});
