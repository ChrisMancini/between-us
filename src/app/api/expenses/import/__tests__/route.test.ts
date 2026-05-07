import { NextResponse } from "next/server";
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
jest.mock("@/lib/models/expense", () => ({
  Expense: { insertMany: jest.fn() },
}));
jest.mock("@/lib/models/category", () => ({
  Category: { find: jest.fn() },
}));
jest.mock("@/lib/validations/csv-import", () => ({
  csvImportApiSchema: { safeParse: jest.fn() },
}));
jest.mock("@/lib/settlement-guard", () => ({ assertMonthsOpen: jest.fn() }));

import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { Category } from "@/lib/models/category";
import { csvImportApiSchema } from "@/lib/validations/csv-import";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { POST } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(csvImportApiSchema.safeParse);
const mockAssertMonthsOpen = asMock(assertMonthsOpen);

const validExpenses = [
  {
    paidBy: "john",
    date: "2026-04-15",
    categoryId: VALID_ID,
    amount: 5000,
    where: "Publix",
    notes: "",
    splitType: "split",
  },
];

describe("POST /api/expenses/import", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/expenses/import", {}));
    await expectStatus(res, 401);
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await POST(makeJsonRequest("/api/expenses/import", {}));
    await expectError(res, 400, "Validation failed");
  });

  it("returns 422 when categories do not exist", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ expenses: validExpenses }));
    asMock(Category.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    const res = await POST(makeJsonRequest("/api/expenses/import", {}));
    await expectError(res, 422, "One or more categories do not exist");
  });

  it("returns 422 when month is settled", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ expenses: validExpenses }));
    asMock(Category.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID }]),
    });
    mockAssertMonthsOpen.mockResolvedValue(
      NextResponse.json({ error: "Settled" }, { status: 422 })
    );
    const res = await POST(makeJsonRequest("/api/expenses/import", {}));
    await expectStatus(res, 422);
  });

  it("returns 201 on success", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ expenses: validExpenses }));
    asMock(Category.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: VALID_ID }]),
    });
    mockAssertMonthsOpen.mockResolvedValue(null);
    asMock(Expense.insertMany).mockResolvedValue([{ _id: VALID_ID_2 }]);

    const res = await POST(makeJsonRequest("/api/expenses/import", {}));
    const body = await expectStatus(res, 201);
    expect(body.imported).toBe(1);
  });
});
