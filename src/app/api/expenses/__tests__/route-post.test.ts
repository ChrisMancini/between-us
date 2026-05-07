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
jest.mock("@/lib/models/category", () => ({
  Category: { findById: jest.fn() },
}));
jest.mock("@/lib/validations/expense", () => ({
  expenseApiSchema: { safeParse: jest.fn() },
}));
jest.mock("@/lib/settlement-guard", () => ({ assertMonthsOpen: jest.fn() }));

import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { Category } from "@/lib/models/category";
import { expenseApiSchema } from "@/lib/validations/expense";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { POST } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(expenseApiSchema.safeParse);
const mockAssertMonthsOpen = asMock(assertMonthsOpen);

const validData = {
  paidBy: "john",
  date: "2026-04-15",
  categoryId: VALID_ID_2,
  amount: 5000,
  where: "Publix",
  notes: "Groceries",
  splitType: "split",
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

  it("returns 400 when categoryId is invalid", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ ...validData, categoryId: "bad" }));
    const res = await POST(makeJsonRequest("/api/expenses", {}));
    await expectError(res, 400, "Invalid category");
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

  it("returns 422 when category not found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    mockAssertMonthsOpen.mockResolvedValue(null);
    asMock(Category.findById).mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/expenses", {}));
    await expectError(res, 422, "Category not found");
  });

  it("returns 201 on success", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(validData));
    mockAssertMonthsOpen.mockResolvedValue(null);
    asMock(Category.findById).mockResolvedValue({ _id: VALID_ID_2 });

    const created = {
      _id: VALID_ID,
      paidBy: "john",
      date: new Date(Date.UTC(2026, 3, 15)),
      amount: 5000,
      where: "Publix",
      notes: "Groceries",
      splitType: "split",
      populate: jest.fn().mockResolvedValue({
        _id: VALID_ID,
        paidBy: "john",
        date: new Date(Date.UTC(2026, 3, 15)),
        amount: 5000,
        where: "Publix",
        notes: "Groceries",
        splitType: "split",
        category: {
          _id: VALID_ID_2,
          name: "Groceries",
          settlementType: "deferred",
          sortOrder: 2,
        },
      }),
    };
    asMock(Expense.create).mockResolvedValue(created);

    const res = await POST(makeJsonRequest("/api/expenses", {}));
    const body = await expectStatus(res, 201);
    expect(body.expense.where).toBe("Publix");
    expect(body.expense.category.name).toBe("Groceries");
  });
});
