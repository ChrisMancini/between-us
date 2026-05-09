import {
  makeSession,
  makeAdminSession,
  makeRequest,
  makeIdContext,
  asMock,
  makeExpense,
  VALID_ID,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock("@/lib/models/expense", () => ({
  Expense: {
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

jest.mock("@/lib/models/settlement", () => ({
  Settlement: {
    findOne: jest.fn(),
  },
}));

jest.mock("@/lib/models/category", () => ({
  Category: { findById: jest.fn() },
}));

jest.mock("@/lib/validations/expense", () => ({
  expenseUpdateApiSchema: {},
}));

jest.mock("@/lib/settlement-guard", () => ({
  assertMonthsOpen: jest.fn(),
}));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));
jest.mock("@/lib/readiness-reset", () => ({ resetReadinessForMonths: jest.fn() }));

import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { Category } from "@/lib/models/category";
import { Settlement } from "@/lib/models/settlement";
import { logActivity } from "@/lib/activity-logger";
import { DELETE } from "../route";

const mockAuth = asMock(auth);
const mockFindById = asMock(Expense.findById);
const mockFindByIdAndDelete = asMock(Expense.findByIdAndDelete);
const mockSettlementFindOne = asMock(Settlement.findOne);

function deleteRequest() {
  return makeRequest(`/api/expenses/${VALID_ID}`, { method: "DELETE" });
}

describe("DELETE /api/expenses/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid ObjectId", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await DELETE(deleteRequest(), makeIdContext("not-an-id"));
    await expectError(res, 400, "Invalid ID");
  });

  it("returns 404 when expense does not exist", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFindById.mockResolvedValue(null);
    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectStatus(res, 404);
  });

  it("returns 403 when user is not the owner", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockFindById.mockResolvedValue(makeExpense({ paidBy: "jane" }));
    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectError(res, 403, "Forbidden");
  });

  it("returns 422 when the expense month is settled", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFindById.mockResolvedValue(makeExpense());
    mockSettlementFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ month: 4, year: 2026, status: "closed" }),
    });
    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectError(res, 422, "already been settled");
  });

  it("deletes the expense and returns success for the owner", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockFindById.mockResolvedValue(makeExpense());
    mockSettlementFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    asMock(Category.findById).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ name: "Groceries" }),
    });
    mockFindByIdAndDelete.mockResolvedValue(null);

    const res = await DELETE(deleteRequest(), makeIdContext());
    const body = await expectStatus(res, 200);
    expect(body).toEqual({ success: true });
    expect(mockFindByIdAndDelete).toHaveBeenCalledWith(VALID_ID);
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "expense_delete",
      expect.stringContaining("Publix"),
      expect.objectContaining({ amount: 5000, where: "Publix" })
    );
  });

  it("allows admin to delete another user's expense", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockFindById.mockResolvedValue(makeExpense({ paidBy: "jane" }));
    mockSettlementFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    asMock(Category.findById).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ name: "Groceries" }),
    });
    mockFindByIdAndDelete.mockResolvedValue(null);

    const res = await DELETE(deleteRequest(), makeIdContext());
    const body = await expectStatus(res, 200);
    expect(body).toEqual({ success: true });
  });
});
