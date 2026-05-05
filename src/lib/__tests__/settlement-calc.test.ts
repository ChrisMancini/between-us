import { calculateSettlement, type SettlementExpenseRow } from "@/lib/settlement-calc";
import type { SerializedCategory } from "@/lib/models/category";

const deferredCategory: SerializedCategory = {
  _id: "cat1",
  name: "Groceries",
  settlementType: "deferred",
  sortOrder: 1,
};

const immediateCategory: SerializedCategory = {
  _id: "cat2",
  name: "Mortgage",
  settlementType: "immediate",
  sortOrder: 0,
};

function makeExpense(
  overrides: Partial<SettlementExpenseRow> = {}
): SettlementExpenseRow {
  return {
    _id: "exp1",
    paidBy: "john",
    amount: 1000,
    splitType: "split",
    where: "Store",
    date: "2025-01-15",
    category: deferredCategory,
    ...overrides,
  };
}

describe("calculateSettlement", () => {
  it("returns zeros and even for empty expenses", () => {
    const result = calculateSettlement([], "john", "jane");
    expect(result).toEqual({
      person1OwesPerson2: 0,
      person2OwesPerson1: 0,
      netOwedBy: "even",
      netAmount: 0,
      deferredExpenses: [],
    });
  });

  it("filters out immediate settlement type expenses", () => {
    const expenses = [makeExpense({ category: immediateCategory })];
    const result = calculateSettlement(expenses, "john", "jane");
    expect(result.person1OwesPerson2).toBe(0);
    expect(result.person2OwesPerson1).toBe(0);
    expect(result.netOwedBy).toBe("even");
    expect(result.deferredExpenses).toHaveLength(0);
  });

  it("splits amount in half for split type", () => {
    const expenses = [makeExpense({ paidBy: "john", amount: 1000, splitType: "split" })];
    const result = calculateSettlement(expenses, "john", "jane");
    expect(result.person2OwesPerson1).toBe(500);
    expect(result.person1OwesPerson2).toBe(0);
    expect(result.netOwedBy).toBe("jane");
    expect(result.netAmount).toBe(500);
  });

  it("uses full amount for full reimbursement type", () => {
    const expenses = [makeExpense({ paidBy: "john", amount: 1000, splitType: "full" })];
    const result = calculateSettlement(expenses, "john", "jane");
    expect(result.person2OwesPerson1).toBe(1000);
    expect(result.netOwedBy).toBe("jane");
    expect(result.netAmount).toBe(1000);
  });

  it("handles both persons paying with correct netting", () => {
    const expenses = [
      makeExpense({ _id: "e1", paidBy: "john", amount: 600, splitType: "split" }),
      makeExpense({ _id: "e2", paidBy: "jane", amount: 400, splitType: "split" }),
    ];
    const result = calculateSettlement(expenses, "john", "jane");
    expect(result.person2OwesPerson1).toBe(300); // jane owes john 300
    expect(result.person1OwesPerson2).toBe(200); // john owes jane 200
    expect(result.netOwedBy).toBe("jane");
    expect(result.netAmount).toBe(100); // net: jane owes 100
  });

  it("returns even when both owe the same amount", () => {
    const expenses = [
      makeExpense({ _id: "e1", paidBy: "john", amount: 1000, splitType: "split" }),
      makeExpense({ _id: "e2", paidBy: "jane", amount: 1000, splitType: "split" }),
    ];
    const result = calculateSettlement(expenses, "john", "jane");
    expect(result.person2OwesPerson1).toBe(500);
    expect(result.person1OwesPerson2).toBe(500);
    expect(result.netOwedBy).toBe("even");
    expect(result.netAmount).toBe(0);
  });

  it("handles odd cent amounts with rounding", () => {
    const expenses = [makeExpense({ amount: 999, splitType: "split" })];
    const result = calculateSettlement(expenses, "john", "jane");
    expect(result.person2OwesPerson1).toBe(Math.round(999 / 2)); // 500
  });

  it("returns person1 as netOwedBy when person1 owes more", () => {
    const expenses = [
      makeExpense({ _id: "e1", paidBy: "jane", amount: 2000, splitType: "split" }),
    ];
    const result = calculateSettlement(expenses, "john", "jane");
    expect(result.netOwedBy).toBe("john");
    expect(result.netAmount).toBe(1000);
  });

  it("includes only deferred expenses in deferredExpenses output", () => {
    const expenses = [
      makeExpense({ _id: "e1", category: deferredCategory }),
      makeExpense({ _id: "e2", category: immediateCategory }),
      makeExpense({ _id: "e3", category: deferredCategory }),
    ];
    const result = calculateSettlement(expenses, "john", "jane");
    expect(result.deferredExpenses).toHaveLength(2);
    expect(result.deferredExpenses.map((e) => e._id)).toEqual(["e1", "e3"]);
  });

  it("accumulates multiple expenses from same payer", () => {
    const expenses = [
      makeExpense({ _id: "e1", paidBy: "john", amount: 500, splitType: "full" }),
      makeExpense({ _id: "e2", paidBy: "john", amount: 300, splitType: "full" }),
    ];
    const result = calculateSettlement(expenses, "john", "jane");
    expect(result.person2OwesPerson1).toBe(800);
  });
});
