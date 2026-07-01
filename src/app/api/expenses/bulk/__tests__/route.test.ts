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
const TAG_ID_B = "607f1f77bcf86cd799439022";

jest.mock("@/lib/action-lifecycle", () => ({
  handleExpenseChange: jest.fn().mockResolvedValue(undefined),
  getOtherPersonKey: jest.fn().mockResolvedValue("jane"),
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/expense", () => ({
  Expense: { find: jest.fn(), findByIdAndUpdate: jest.fn() },
}));
jest.mock("@/lib/models/tag", () => ({
  Tag: { find: jest.fn() },
}));
jest.mock("@/lib/models/settlement", () => ({
  Settlement: { find: jest.fn() },
}));
jest.mock("@/lib/validations/bulk-expense", () => ({
  bulkExpenseUpdateSchema: { safeParse: jest.fn() },
}));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));
jest.mock("@/lib/readiness-reset", () => ({ resetReadinessForMonths: jest.fn() }));

import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { Settlement } from "@/lib/models/settlement";
import { bulkExpenseUpdateSchema } from "@/lib/validations/bulk-expense";
import { logActivity } from "@/lib/activity-logger";
import { resetReadinessForMonths } from "@/lib/readiness-reset";
import { handleExpenseChange } from "@/lib/action-lifecycle";
import { PATCH } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(bulkExpenseUpdateSchema.safeParse);

function patchRequest() {
  return makeJsonRequest("/api/expenses/bulk", {}, "PATCH");
}

function mockObjectId(id: string) {
  return { toString: () => id };
}

function makeExpenseDoc(overrides?: Record<string, unknown>) {
  const base = makeExpense(overrides);
  if (!overrides?.tags) {
    base.tags = [mockObjectId(VALID_ID_2)] as unknown[];
  }
  return {
    ...base,
    toObject: jest.fn().mockReturnThis(),
  };
}

function mockPopulatedUpdate(overrides?: Record<string, unknown>) {
  const base = makeExpense(overrides);
  return {
    populate: jest.fn().mockResolvedValue(base),
  };
}

function mockNoSettlements() {
  asMock(Settlement.find).mockReturnValue({
    lean: jest.fn().mockResolvedValue([]),
  });
}

function mockTagsExist(count: number) {
  const tags = Array.from({ length: count }, (_, i) => ({ _id: `tag-${i}` }));
  asMock(Tag.find).mockReturnValue({
    lean: jest.fn().mockResolvedValue(tags),
  });
}

describe("PATCH /api/expenses/bulk", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(patchRequest());
    await expectStatus(res, 401);
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await PATCH(patchRequest());
    await expectError(res, 400, "Validation failed");
  });

  it("returns 400 for invalid expense ID", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: ["bad-id"], splitType: "full" }),
    );
    const res = await PATCH(patchRequest());
    await expectError(res, 400, "Invalid expense ID");
  });

  it("returns 400 for invalid tag ID", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        expenseIds: [VALID_ID],
        tags: { mode: "replace", tagIds: ["bad-tag"] },
      }),
    );
    const res = await PATCH(patchRequest());
    await expectError(res, 400, "Invalid tag ID");
  });

  it("returns 422 when tags not found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        expenseIds: [VALID_ID],
        tags: { mode: "replace", tagIds: [TAG_ID_A, TAG_ID_B] },
      }),
    );
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: TAG_ID_A }]),
    });
    const res = await PATCH(patchRequest());
    await expectError(res, 422, "One or more tags not found");
  });

  it("replaces tags on any expense (settled or not, any owner)", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        expenseIds: [VALID_ID],
        tags: { mode: "replace", tagIds: [TAG_ID_A] },
      }),
    );
    mockTagsExist(1);

    const expense = makeExpenseDoc({ paidBy: "jane", tags: [mockObjectId(TAG_ID_B)] });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    asMock(Expense.findByIdAndUpdate).mockReturnValue(
      mockPopulatedUpdate({ tags: [{ _id: TAG_ID_A, path: "New", sortOrder: 1 }] }),
    );

    const res = await PATCH(patchRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.updated).toBe(1);
    expect(body.results[0].changedFields).toContain("tags");
  });

  it("adds tags without duplicates", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        expenseIds: [VALID_ID],
        tags: { mode: "add", tagIds: [TAG_ID_A, TAG_ID_B] },
      }),
    );
    mockTagsExist(2);

    const expense = makeExpenseDoc({ tags: [mockObjectId(TAG_ID_A)] });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    asMock(Expense.findByIdAndUpdate).mockReturnValue(
      mockPopulatedUpdate({ tags: [{ _id: TAG_ID_A, path: "Existing", sortOrder: 1 }, { _id: TAG_ID_B, path: "New", sortOrder: 2 }] }),
    );

    const res = await PATCH(patchRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.updated).toBe(1);

    const updateCall = asMock(Expense.findByIdAndUpdate).mock.calls[0];
    const tagIds = updateCall[1].tags as string[];
    expect(tagIds).toContain(TAG_ID_A);
    expect(tagIds).toContain(TAG_ID_B);
    expect(tagIds.length).toBe(2);
  });

  it("skips tag removal that would leave 0 tags but still applies other fields", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        expenseIds: [VALID_ID],
        tags: { mode: "remove", tagIds: [TAG_ID_A] },
        splitType: "full",
      }),
    );
    mockTagsExist(1);

    const expense = makeExpenseDoc({
      tags: [mockObjectId(TAG_ID_A)],
      splitType: "split",
    });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    asMock(Expense.findByIdAndUpdate).mockReturnValue(
      mockPopulatedUpdate({ splitType: "full", tags: [{ _id: TAG_ID_A, path: "Only", sortOrder: 1 }] }),
    );

    const res = await PATCH(patchRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.updated).toBe(1);
    expect(body.results[0].changedFields).toContain("split type");
    expect(body.results[0].changedFields).not.toContain("tags");
  });

  it("skips split type for settled expenses", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID], splitType: "full" }),
    );

    const expense = makeExpenseDoc({ splitType: "split" });
    asMock(Expense.find).mockResolvedValue([expense]);
    asMock(Settlement.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ year: 2026, month: 4, status: "closed" }]),
    });

    const res = await PATCH(patchRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.skipped).toBe(1);
    expect(body.results[0].reason).toBe("settled");
  });

  it("skips split type for non-owner expenses", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID], splitType: "full" }),
    );

    const expense = makeExpenseDoc({ paidBy: "jane", splitType: "split" });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();

    const res = await PATCH(patchRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.skipped).toBe(1);
    expect(body.results[0].reason).toBe("not_owner");
  });

  it("allows admin to edit any expense split type", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID], splitType: "full" }),
    );

    const expense = makeExpenseDoc({ paidBy: "jane", splitType: "split" });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    asMock(Expense.findByIdAndUpdate).mockReturnValue(
      mockPopulatedUpdate({ paidBy: "jane", splitType: "full" }),
    );

    const res = await PATCH(patchRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.updated).toBe(1);
  });

  it("skips split type for settled expenses even when admin", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID], splitType: "full" }),
    );

    const expense = makeExpenseDoc({ paidBy: "jane", splitType: "split" });
    asMock(Expense.find).mockResolvedValue([expense]);
    asMock(Settlement.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ year: 2026, month: 4, status: "closed" }]),
    });

    const res = await PATCH(patchRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.skipped).toBe(1);
    expect(body.results[0].reason).toBe("settled");
  });

  it("calls handleExpenseChange when settlement type changes", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID], settlementType: "immediate" }),
    );

    const expense = makeExpenseDoc({ settlementType: "deferred" });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    asMock(Expense.findByIdAndUpdate).mockReturnValue(
      mockPopulatedUpdate({ settlementType: "immediate" }),
    );

    const res = await PATCH(patchRequest());
    await expectStatus(res, 200);
    expect(handleExpenseChange).toHaveBeenCalledWith(
      expense,
      expect.objectContaining({ settlementType: "immediate" }),
      "jane",
      "john",
    );
  });

  it("logs activity with (bulk edit) suffix per expense", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID], splitType: "full" }),
    );

    const expense = makeExpenseDoc({ splitType: "split" });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    asMock(Expense.findByIdAndUpdate).mockReturnValue(
      mockPopulatedUpdate({ splitType: "full" }),
    );

    const res = await PATCH(patchRequest());
    await expectStatus(res, 200);
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "expense_edit",
      expect.stringContaining("(bulk edit)"),
      expect.objectContaining({ bulkEdit: true, changedFields: ["split type"] }),
    );
  });

  it("calls resetReadinessForMonths only for split/settlement changes", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        expenseIds: [VALID_ID, VALID_ID_3],
        tags: { mode: "replace", tagIds: [TAG_ID_A] },
        splitType: "full",
      }),
    );
    mockTagsExist(1);

    const expense1 = makeExpenseDoc({ _id: VALID_ID, splitType: "split", tags: [mockObjectId(TAG_ID_B)] });
    const expense2 = makeExpenseDoc({ _id: VALID_ID_3, paidBy: "jane", splitType: "split", tags: [mockObjectId(TAG_ID_B)] });
    asMock(Expense.find).mockResolvedValue([expense1, expense2]);
    mockNoSettlements();
    asMock(Expense.findByIdAndUpdate).mockReturnValue(
      mockPopulatedUpdate({ tags: [{ _id: TAG_ID_A, path: "New", sortOrder: 1 }], splitType: "full" }),
    );

    await PATCH(patchRequest());

    const resetCall = asMock(resetReadinessForMonths).mock.calls[0];
    expect(resetCall[1].length).toBe(1);
  });

  it("does not call resetReadinessForMonths for tag-only changes", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({
        expenseIds: [VALID_ID],
        tags: { mode: "replace", tagIds: [TAG_ID_A] },
      }),
    );
    mockTagsExist(1);

    const expense = makeExpenseDoc({ tags: [mockObjectId(TAG_ID_B)] });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();
    asMock(Expense.findByIdAndUpdate).mockReturnValue(
      mockPopulatedUpdate({ tags: [{ _id: TAG_ID_A, path: "New", sortOrder: 1 }] }),
    );

    await PATCH(patchRequest());
    expect(resetReadinessForMonths).not.toHaveBeenCalled();
  });

  it("handles mixed results (some updated, some skipped)", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID, VALID_ID_3], splitType: "full" }),
    );

    const ownExpense = makeExpenseDoc({ _id: VALID_ID, paidBy: "john", splitType: "split" });
    const otherExpense = makeExpenseDoc({ _id: VALID_ID_3, paidBy: "jane", splitType: "split" });
    asMock(Expense.find).mockResolvedValue([ownExpense, otherExpense]);
    mockNoSettlements();
    asMock(Expense.findByIdAndUpdate).mockReturnValue(
      mockPopulatedUpdate({ splitType: "full" }),
    );

    const res = await PATCH(patchRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.updated).toBe(1);
    expect(body.summary.skipped).toBe(1);

    const updated = body.results.find((r: { status: string }) => r.status === "updated");
    const skipped = body.results.find((r: { status: string }) => r.status === "skipped");
    expect(updated.expenseId).toBe(VALID_ID);
    expect(skipped.expenseId).toBe(VALID_ID_3);
    expect(skipped.reason).toBe("not_owner");
  });

  it("skips expenses with no actual changes", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ expenseIds: [VALID_ID], splitType: "split" }),
    );

    const expense = makeExpenseDoc({ splitType: "split" });
    asMock(Expense.find).mockResolvedValue([expense]);
    mockNoSettlements();

    const res = await PATCH(patchRequest());
    const body = await expectStatus(res, 200);
    expect(body.summary.skipped).toBe(1);
    expect(body.results[0].reason).toBe("no_changes");
    expect(Expense.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
