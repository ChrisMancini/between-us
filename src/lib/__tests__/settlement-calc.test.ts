import {
  calculateSettlement,
  calculateRunningBalance,
  type SettlementExpenseRow,
  type SettlementBreakdown,
} from "@/lib/settlement-calc";

function makeExpense(
  overrides: Partial<SettlementExpenseRow> = {}
): SettlementExpenseRow {
  return {
    _id: "exp1",
    paidBy: "john",
    amount: 1000,
    splitType: "split",
    settlementType: "deferred",
    where: "Store",
    date: "2025-01-15",
    tags: [],
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
    const expenses = [makeExpense({ settlementType: "immediate" })];
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
      makeExpense({ _id: "e1", settlementType: "deferred" }),
      makeExpense({ _id: "e2", settlementType: "immediate" }),
      makeExpense({ _id: "e3", settlementType: "deferred" }),
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

function makeBreakdown(
  overrides: Partial<SettlementBreakdown> = {}
): SettlementBreakdown {
  return {
    person1OwesPerson2: 0,
    person2OwesPerson1: 0,
    netOwedBy: "even",
    netAmount: 0,
    deferredExpenses: [],
    ...overrides,
  };
}

describe("calculateRunningBalance", () => {
  it("returns even with monthCount 0 for empty array", () => {
    const result = calculateRunningBalance([], "john", "jane");
    expect(result).toEqual({
      netOwedBy: "even",
      netAmount: 0,
      monthCount: 0,
    });
  });

  it("passes through a single breakdown", () => {
    const breakdowns = [
      makeBreakdown({
        person1OwesPerson2: 200,
        person2OwesPerson1: 500,
        netOwedBy: "jane",
        netAmount: 300,
      }),
    ];
    const result = calculateRunningBalance(breakdowns, "john", "jane");
    expect(result).toEqual({
      netOwedBy: "jane",
      netAmount: 300,
      monthCount: 1,
    });
  });

  it("sums two breakdowns in the same direction", () => {
    const breakdowns = [
      makeBreakdown({ person1OwesPerson2: 0, person2OwesPerson1: 500 }),
      makeBreakdown({ person1OwesPerson2: 0, person2OwesPerson1: 300 }),
    ];
    const result = calculateRunningBalance(breakdowns, "john", "jane");
    expect(result).toEqual({
      netOwedBy: "jane",
      netAmount: 800,
      monthCount: 2,
    });
  });

  it("nets two breakdowns in opposing directions", () => {
    const breakdowns = [
      makeBreakdown({ person1OwesPerson2: 0, person2OwesPerson1: 700 }),
      makeBreakdown({ person1OwesPerson2: 400, person2OwesPerson1: 0 }),
    ];
    const result = calculateRunningBalance(breakdowns, "john", "jane");
    expect(result).toEqual({
      netOwedBy: "jane",
      netAmount: 300,
      monthCount: 2,
    });
  });

  it("returns even when breakdowns cancel out", () => {
    const breakdowns = [
      makeBreakdown({ person1OwesPerson2: 0, person2OwesPerson1: 500 }),
      makeBreakdown({ person1OwesPerson2: 500, person2OwesPerson1: 0 }),
    ];
    const result = calculateRunningBalance(breakdowns, "john", "jane");
    expect(result).toEqual({
      netOwedBy: "even",
      netAmount: 0,
      monthCount: 2,
    });
  });

  it("accumulates 3+ breakdowns correctly", () => {
    const breakdowns = [
      makeBreakdown({ person1OwesPerson2: 100, person2OwesPerson1: 400 }),
      makeBreakdown({ person1OwesPerson2: 200, person2OwesPerson1: 100 }),
      makeBreakdown({ person1OwesPerson2: 0, person2OwesPerson1: 300 }),
    ];
    // totals: p1OwesP2 = 300, p2OwesP1 = 800, net = 800-300 = 500 → jane owes
    const result = calculateRunningBalance(breakdowns, "john", "jane");
    expect(result).toEqual({
      netOwedBy: "jane",
      netAmount: 500,
      monthCount: 3,
    });
  });
});
