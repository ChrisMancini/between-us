jest.mock("server-only", () => ({}));
jest.mock("@/lib/models/action", () => ({
  Action: {
    create: jest.fn(),
    find: jest.fn(),
    updateMany: jest.fn(),
  },
}));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));
jest.mock("@/lib/persons", () => ({
  getPersons: jest.fn().mockResolvedValue([
    { key: "chris", displayName: "Chris" },
    { key: "lauren", displayName: "Lauren" },
  ]),
}));

import { Action } from "@/lib/models/action";
import { logActivity } from "@/lib/activity-logger";
import { getPersons } from "@/lib/persons";
import {
  createActionForExpense,
  createActionForSettlement,
  cancelPendingActions,
  handleExpenseChange,
  handleExpenseDelete,
  handleSettlementReopen,
  getOtherPersonKey,
} from "@/lib/action-lifecycle";

const mockCreate = Action.create as jest.Mock;
const mockFind = Action.find as jest.Mock;
const mockUpdateMany = Action.updateMany as jest.Mock;
const mockGetPersons = getPersons as jest.Mock;

const defaultPersons = [
  { key: "chris", displayName: "Chris" },
  { key: "lauren", displayName: "Lauren" },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPersons.mockResolvedValue(defaultPersons);
});

function makeExpenseDoc(overrides?: Record<string, unknown>) {
  return {
    _id: "exp-1",
    paidBy: "chris",
    amount: 5000,
    splitType: "split" as const,
    settlementType: "immediate" as const,
    where: "Publix",
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
}

function makeSettlementDoc(overrides?: Record<string, unknown>) {
  return {
    _id: "set-1",
    month: 6,
    year: 2026,
    totalOwed: 10000,
    owedBy: "lauren",
    owedTo: "chris",
    ...overrides,
  };
}

describe("getOtherPersonKey", () => {


  it("returns the other person's key", async () => {
    mockGetPersons.mockResolvedValue([
      { key: "chris" },
      { key: "lauren" },
    ]);
    expect(await getOtherPersonKey("chris")).toBe("lauren");
    expect(await getOtherPersonKey("lauren")).toBe("chris");
  });

  it("throws when persons not configured", async () => {
    mockGetPersons.mockResolvedValue(null);
    await expect(getOtherPersonKey("chris")).rejects.toThrow(
      "Persons not configured"
    );
  });
});

describe("createActionForExpense", () => {


  it("creates action with split amount", async () => {
    const expense = makeExpenseDoc();
    mockCreate.mockResolvedValue({ _id: "act-1" });

    const result = await createActionForExpense(expense as never, "lauren", "chris");

    expect(result).toEqual({ _id: "act-1" });
    expect(mockCreate).toHaveBeenCalledWith({
      sourceType: "expense",
      sourceId: "exp-1",
      debtorKey: "lauren",
      creditorKey: "chris",
      amount: 2500,
      status: "pending",
      description: "at Publix",
    });
    expect(logActivity).toHaveBeenCalledWith(
      "chris",
      "action_created",
      expect.stringContaining("$25.00"),
      expect.objectContaining({ actionId: "act-1", expenseId: "exp-1" })
    );
  });

  it("creates action with full amount", async () => {
    const expense = makeExpenseDoc({ splitType: "full" });
    mockCreate.mockResolvedValue({ _id: "act-2" });

    await createActionForExpense(expense as never, "lauren", "chris");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000 })
    );
  });

  it("returns null for deferred expenses", async () => {
    const expense = makeExpenseDoc({ settlementType: "deferred" });
    const result = await createActionForExpense(expense as never, "lauren", "chris");
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("createActionForSettlement", () => {


  it("creates action with settlement description", async () => {
    const settlement = makeSettlementDoc();
    mockCreate.mockResolvedValue({ _id: "act-3" });

    const result = await createActionForSettlement(settlement as never, "chris");

    expect(result).toEqual({ _id: "act-3" });
    expect(mockCreate).toHaveBeenCalledWith({
      sourceType: "settlement",
      sourceId: "set-1",
      debtorKey: "lauren",
      creditorKey: "chris",
      amount: 10000,
      status: "pending",
      description: "June 2026 settlement",
    });
    expect(logActivity).toHaveBeenCalledWith(
      "chris",
      "action_created",
      expect.stringContaining("$100.00"),
      expect.objectContaining({ actionId: "act-3" })
    );
  });

  it("returns null when totalOwed is 0", async () => {
    const settlement = makeSettlementDoc({ totalOwed: 0 });
    const result = await createActionForSettlement(settlement as never, "chris");
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("cancelPendingActions", () => {


  it("cancels only pending actions and logs each", async () => {
    const pendingActions = [
      { _id: "act-1", amount: 2500, description: "at Publix" },
      { _id: "act-2", amount: 3000, description: "at Target" },
    ];
    mockFind.mockResolvedValue(pendingActions);
    mockUpdateMany.mockResolvedValue({ modifiedCount: 2 });

    const count = await cancelPendingActions("expense", "exp-1", "expense updated", "chris");

    expect(count).toBe(2);
    expect(mockFind).toHaveBeenCalledWith({
      sourceType: "expense",
      sourceId: "exp-1",
      status: "pending",
    });
    expect(mockUpdateMany).toHaveBeenCalledWith(
      { sourceType: "expense", sourceId: "exp-1", status: "pending" },
      expect.objectContaining({
        status: "cancelled",
        cancelReason: "expense updated",
      })
    );
    expect(logActivity).toHaveBeenCalledTimes(2);
  });

  it("returns 0 when no pending actions exist", async () => {
    mockFind.mockResolvedValue([]);
    const count = await cancelPendingActions("expense", "exp-1", "test", "chris");
    expect(count).toBe(0);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

describe("handleExpenseChange", () => {


  it("is a no-op for deferred → deferred", async () => {
    const old = makeExpenseDoc({ settlementType: "deferred" });
    await handleExpenseChange(old as never, { settlementType: "deferred" }, "lauren", "chris");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("cancels pending actions for immediate → deferred", async () => {
    const old = makeExpenseDoc();
    mockFind.mockResolvedValue([{ _id: "act-1", amount: 2500, description: "at Publix" }]);
    mockUpdateMany.mockResolvedValue({ modifiedCount: 1 });

    await handleExpenseChange(old as never, { settlementType: "deferred" }, "lauren", "chris");

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "expense", sourceId: "exp-1", status: "pending" })
    );
    expect(mockUpdateMany).toHaveBeenCalled();
  });

  it("creates new action for deferred → immediate", async () => {
    const old = makeExpenseDoc({ settlementType: "deferred" });
    mockCreate.mockResolvedValue({ _id: "act-new" });

    await handleExpenseChange(old as never, { settlementType: "immediate" }, "lauren", "chris");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "expense", status: "pending" })
    );
  });

  it("cancels and replaces pending actions when amount changes (immediate → immediate)", async () => {
    const old = makeExpenseDoc({ amount: 5000, splitType: "split" });
    mockFind.mockResolvedValue([{ _id: "act-old", amount: 2500, description: "at Publix" }]);
    mockUpdateMany.mockResolvedValue({ modifiedCount: 1 });
    mockCreate.mockResolvedValue({ _id: "act-new" });

    await handleExpenseChange(old as never, { amount: 8000 }, "lauren", "chris");

    expect(mockUpdateMany).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4000 })
    );
  });

  it("creates delta action (same direction) when paid actions exist and amount increases", async () => {
    const old = makeExpenseDoc({ amount: 5000, splitType: "split" });
    mockFind.mockResolvedValue([]);

    mockCreate.mockResolvedValue({ _id: "act-delta" });

    await handleExpenseChange(old as never, { amount: 7000 }, "lauren", "chris");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        debtorKey: "lauren",
        creditorKey: "chris",
        amount: 1000,
        description: "at Publix (adjustment)",
      })
    );
  });

  it("creates delta action (reversed direction) when paid actions exist and amount decreases", async () => {
    const old = makeExpenseDoc({ amount: 5000, splitType: "split" });
    mockFind.mockResolvedValue([]);

    mockCreate.mockResolvedValue({ _id: "act-delta" });

    await handleExpenseChange(old as never, { amount: 3000 }, "lauren", "chris");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        debtorKey: "chris",
        creditorKey: "lauren",
        amount: 1000,
        description: "at Publix (adjustment)",
      })
    );
  });

  it("is a no-op when amount unchanged (immediate → immediate)", async () => {
    const old = makeExpenseDoc({ amount: 5000, splitType: "split" });
    await handleExpenseChange(old as never, { amount: 5000 }, "lauren", "chris");
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("handleExpenseDelete", () => {


  it("cancels pending actions for immediate expense", async () => {
    const expense = makeExpenseDoc();
    mockFind.mockResolvedValue([{ _id: "act-1", amount: 2500, description: "at Publix" }]);
    mockUpdateMany.mockResolvedValue({ modifiedCount: 1 });

    await handleExpenseDelete(expense as never, "chris");

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "expense", sourceId: "exp-1" })
    );
  });

  it("is a no-op for deferred expense", async () => {
    const expense = makeExpenseDoc({ settlementType: "deferred" });
    await handleExpenseDelete(expense as never, "chris");
    expect(mockFind).not.toHaveBeenCalled();
  });
});

describe("handleSettlementReopen", () => {


  it("cancels pending actions for settlement", async () => {
    mockFind.mockResolvedValue([{ _id: "act-1", amount: 10000, description: "June 2026 settlement" }]);
    mockUpdateMany.mockResolvedValue({ modifiedCount: 1 });

    await handleSettlementReopen("set-1", "chris");

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "settlement", sourceId: "set-1" })
    );
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "settlement", sourceId: "set-1" }),
      expect.objectContaining({ cancelReason: "month reopened" })
    );
  });
});
