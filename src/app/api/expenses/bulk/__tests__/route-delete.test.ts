import {
  makeSession,
  makeAdminSession,
  asMock,
  makeJsonRequest,
  makeExpense,
  makeParsedSuccess,
  makeParsedFailure,
  VALID_ID,
  VALID_ID_2,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

const VALID_ID_3 = "507f1f77bcf86cd799439033";
const TAG_ID_A = "607f1f77bcf86cd799439011";

jest.mock("@/lib/action-lifecycle", () => ({
  handleExpenseDelete: jest.fn().mockResolvedValue(undefined),
  handleExpenseChange: jest.fn().mockResolvedValue(undefined),
  getOtherPersonKey: jest.fn().mockResolvedValue("jane"),
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/expense", () => ({
  Expense: { find: jest.fn(), findByIdAndDelete: jest.fn(), findByIdAndUpdate: jest.fn() },
}));
jest.mock("@/lib/models/tag", () => ({
  Tag: { find: jest.fn() },
}));
jest.mock("@/lib/models/settlement", () => ({
  Settlement: { find: jest.fn() },
}));
jest.mock("@/lib/validations/bulk-expense", () => ({
  bulkExpenseUpdateSchema: { safeParse: jest.fn() },
  bulkExpenseDeleteSchema: { safeParse: jest.fn() },
}));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));
jest.mock("@/lib/readiness-reset", () => ({ resetReadinessForMonths: jest.fn() }));

import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { Settlement } from "@/lib/models/settlement";
import { bulkExpenseDeleteSchema } from "@/lib/validations/bulk-expense";
import { logActivity } from "@/lib/activity-logger";
import { resetReadinessForMonths } from "@/lib/readiness-reset";
import { handleExpenseDelete } from "@/lib/action-lifecycle";
import { DELETE } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(bulkExpenseDeleteSchema.safeParse);

function deleteRequest() {
  return makeJsonRequest("/api/expenses/bulk", {}, "DELETE");
}

function mockObjectId(id: string) {
  return { toString: () => id };
}

function makeExpenseDoc(overrides?: Record<string, unknown>) {
  const base = makeExpense(overrides);
  if (!overrides?.tags) {
    base.tags = [mockObjectId(TAG_ID_A)] as unknown[];
  }
  return base;
}

function mockNoSettlements() {
  asMock(Settlement.find).mockReturnValue({
    lean: jest.fn().mockResolvedValue([]),
  });
}

function mockTagLookup() {
  asMock(Tag.find).mockReturnValue({
    lean: jest.fn().mockResolvedValue([{ _id: TAG_ID_A, path: "Groceries" }]),
  });
}

describe("DELETE /api/expenses/bulk", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(deleteRequest());
    await expectStatus(res, 401);
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await DELETE(deleteRequest());
    await expectError(res, 400, "Validation failed");
  });

  it("returns 400 for invalid expense ID", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: ["bad-id"] }),
    );
    const res = await DELETE(deleteRequest());
    await expectError(res, 400, "Invalid expense ID");
  });

  it("deletes own expenses successfully", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID] }),
    );

    const expense = makeExpenseDoc({ paidBy: "john" });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    mockTagLookup();
    asMock(Expense.findByIdAndDelete).mockResolvedValue(expense);

    const res = await DELETE(deleteRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.deleted).toBe(1);
    expect(body.summary.skipped).toBe(0);
    expect(body.results[0].status).toBe("deleted");
    expect(Expense.findByIdAndDelete).toHaveBeenCalledWith(VALID_ID);
  });

  it("skips settled expenses", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID] }),
    );

    const expense = makeExpenseDoc();
    asMock(Expense.find).mockResolvedValue([expense]);
    asMock(Settlement.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ year: 2026, month: 4, status: "closed" }]),
    });
    mockTagLookup();

    const res = await DELETE(deleteRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.skipped).toBe(1);
    expect(body.results[0].reason).toBe("settled");
    expect(Expense.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("skips other user's expenses for non-admin", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID] }),
    );

    const expense = makeExpenseDoc({ paidBy: "jane" });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    mockTagLookup();

    const res = await DELETE(deleteRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.skipped).toBe(1);
    expect(body.results[0].reason).toBe("not_owner");
    expect(Expense.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("allows admin to delete any expense", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID] }),
    );

    const expense = makeExpenseDoc({ paidBy: "jane" });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    mockTagLookup();
    asMock(Expense.findByIdAndDelete).mockResolvedValue(expense);

    const res = await DELETE(deleteRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.deleted).toBe(1);
  });

  it("handles mixed results (some deleted, some skipped)", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID, VALID_ID_3] }),
    );

    const ownExpense = makeExpenseDoc({ _id: VALID_ID, paidBy: "john" });
    const otherExpense = makeExpenseDoc({ _id: VALID_ID_3, paidBy: "jane" });
    asMock(Expense.find).mockResolvedValue([ownExpense, otherExpense]);
    mockNoSettlements();
    mockTagLookup();
    asMock(Expense.findByIdAndDelete).mockResolvedValue(ownExpense);

    const res = await DELETE(deleteRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.deleted).toBe(1);
    expect(body.summary.skipped).toBe(1);

    const deleted = body.results.find((r: { status: string }) => r.status === "deleted");
    const skipped = body.results.find((r: { status: string }) => r.status === "skipped");
    expect(deleted.expenseId).toBe(VALID_ID);
    expect(skipped.expenseId).toBe(VALID_ID_3);
    expect(skipped.reason).toBe("not_owner");
  });

  it("calls handleExpenseDelete per deleted expense", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID] }),
    );

    const expense = makeExpenseDoc();
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    mockTagLookup();
    asMock(Expense.findByIdAndDelete).mockResolvedValue(expense);

    await DELETE(deleteRequest());
    expect(handleExpenseDelete).toHaveBeenCalledWith(expense, "john");
  });

  it("calls resetReadinessForMonths once with all dates", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID, VALID_ID_2] }),
    );

    const expense1 = makeExpenseDoc({ _id: VALID_ID });
    const expense2 = makeExpenseDoc({ _id: VALID_ID_2, date: new Date(Date.UTC(2026, 4, 10)) });
    asMock(Expense.find).mockResolvedValue([expense1, expense2]);
    mockNoSettlements();
    mockTagLookup();
    asMock(Expense.findByIdAndDelete).mockResolvedValue({});

    await DELETE(deleteRequest());
    expect(resetReadinessForMonths).toHaveBeenCalledTimes(1);
    const resetCall = asMock(resetReadinessForMonths).mock.calls[0];
    expect(resetCall[0]).toBe("john");
    expect(resetCall[1]).toHaveLength(2);
  });

  it("does not call resetReadinessForMonths when all skipped", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID] }),
    );

    const expense = makeExpenseDoc({ paidBy: "jane" });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    mockTagLookup();

    await DELETE(deleteRequest());
    expect(resetReadinessForMonths).not.toHaveBeenCalled();
  });

  it("logs expense_delete with (bulk delete) and bulkDelete: true", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID] }),
    );

    const expense = makeExpenseDoc();
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    mockTagLookup();
    asMock(Expense.findByIdAndDelete).mockResolvedValue(expense);

    await DELETE(deleteRequest());
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "expense_delete",
      expect.stringContaining("(bulk delete)"),
      expect.objectContaining({ bulkDelete: true, paidBy: "john" }),
    );
  });
});
