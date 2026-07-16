jest.mock("@/lib/models/expense", () => ({
  Expense: { find: jest.fn() },
}));
jest.mock("@/lib/settlement-calc", () => ({
  calculateSettlement: jest.fn(),
  calculateRunningBalance: jest.fn(),
}));
jest.mock("@/lib/utils", () => ({
  getMonthDateRange: jest.fn((m: number, y: number) => ({
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m, 1)),
  })),
}));

import { Expense } from "@/lib/models/expense";
import {
  calculateSettlement,
  calculateRunningBalance,
  type SettlementBreakdown,
} from "@/lib/settlement-calc";
import { fetchRunningBalance } from "../running-balance-data";

const mockFind = Expense.find as jest.Mock;
const mockCalcSettlement = calculateSettlement as jest.Mock;
const mockCalcRunningBalance = calculateRunningBalance as jest.Mock;

function mockLean(data: unknown) {
  return { lean: jest.fn().mockResolvedValue(data) };
}

const PERSON1 = "chris";
const PERSON2 = "lauren";

const emptyBreakdown: SettlementBreakdown = {
  person1OwesPerson2: 0,
  person2OwesPerson1: 0,
  netOwedBy: "even",
  netAmount: 0,
  deferredExpenses: [],
};

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    unsettledMonths: [{ month: 5, year: 2026 }, { month: 6, year: 2026 }],
    reopenedSettlements: [],
    closedSet: new Set<string>(),
    currentMonth: 7,
    currentYear: 2026,
    viewedMonth: 6,
    viewedYear: 2026,
    isClosed: false,
    viewedBreakdown: emptyBreakdown,
    person1Key: PERSON1,
    person2Key: PERSON2,
    ...overrides,
  };
}

describe("fetchRunningBalance", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when the viewed month is closed", async () => {
    const result = await fetchRunningBalance(baseParams({ isClosed: true }));
    expect(result).toBeNull();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("returns null when there is only one open month", async () => {
    // Current month (7) is already in unsettled, so total is still 1.
    const result = await fetchRunningBalance(
      baseParams({
        unsettledMonths: [{ month: 7, year: 2026 }],
        viewedMonth: 7,
        viewedYear: 2026,
      })
    );
    expect(result).toBeNull();
  });

  it("adds current month to open months if not already present", async () => {
    mockFind.mockReturnValue(mockLean([]));
    mockCalcSettlement.mockReturnValue(emptyBreakdown);
    mockCalcRunningBalance.mockReturnValue({
      totalOwed: 0,
      owedBy: PERSON1,
      owedTo: PERSON2,
    });

    await fetchRunningBalance(baseParams());

    // Current month (7/2026) is not in unsettled or closed, so it gets added.
    // Viewed month is 6/2026, so other months are 5/2026 and 7/2026 — two queries.
    expect(mockFind).toHaveBeenCalledTimes(2);
  });

  it("does not add current month if already in unsettled list", async () => {
    mockFind.mockReturnValue(mockLean([]));
    mockCalcSettlement.mockReturnValue(emptyBreakdown);
    mockCalcRunningBalance.mockReturnValue({
      totalOwed: 0,
      owedBy: PERSON1,
      owedTo: PERSON2,
    });

    await fetchRunningBalance(
      baseParams({
        unsettledMonths: [
          { month: 5, year: 2026 },
          { month: 6, year: 2026 },
          { month: 7, year: 2026 },
        ],
      })
    );

    // Other months (excluding viewed 6): 5 and 7 — two queries.
    expect(mockFind).toHaveBeenCalledTimes(2);
  });

  it("does not add current month if it is in the closed set", async () => {
    mockFind.mockReturnValue(mockLean([]));
    mockCalcSettlement.mockReturnValue(emptyBreakdown);
    mockCalcRunningBalance.mockReturnValue({
      totalOwed: 0,
      owedBy: PERSON1,
      owedTo: PERSON2,
    });

    await fetchRunningBalance(
      baseParams({ closedSet: new Set(["2026-7"]) })
    );

    // Current month is closed so not added. Other months: just 5. Viewed (6) is open and included via viewedBreakdown.
    expect(mockFind).toHaveBeenCalledTimes(1);
  });

  it("includes viewedBreakdown when viewed month is open", async () => {
    const viewedBreakdown: SettlementBreakdown = {
      ...emptyBreakdown,
      person1OwesPerson2: 5000,
      netAmount: 2500,
    };

    mockFind.mockReturnValue(mockLean([]));
    const otherBreakdown = { ...emptyBreakdown, person2OwesPerson1: 3000 };
    mockCalcSettlement.mockReturnValue(otherBreakdown);
    const expectedBalance = { totalOwed: 1000, owedBy: PERSON1, owedTo: PERSON2 };
    mockCalcRunningBalance.mockReturnValue(expectedBalance);

    const result = await fetchRunningBalance(baseParams({ viewedBreakdown }));

    expect(mockCalcRunningBalance).toHaveBeenCalledWith(
      expect.arrayContaining([viewedBreakdown]),
      PERSON1,
      PERSON2,
    );
    expect(result).toEqual(expectedBalance);
  });

  it("excludes viewedBreakdown when viewed month is not in open list", async () => {
    const viewedBreakdown: SettlementBreakdown = {
      ...emptyBreakdown,
      person1OwesPerson2: 9999,
    };

    mockFind.mockReturnValue(mockLean([]));
    mockCalcSettlement.mockReturnValue(emptyBreakdown);
    mockCalcRunningBalance.mockReturnValue({
      totalOwed: 0,
      owedBy: PERSON1,
      owedTo: PERSON2,
    });

    await fetchRunningBalance(
      baseParams({
        viewedMonth: 3,
        viewedYear: 2026,
        viewedBreakdown,
      })
    );

    const breakdowns = mockCalcRunningBalance.mock.calls[0][0] as SettlementBreakdown[];
    expect(breakdowns.every((b) => b.person1OwesPerson2 !== 9999)).toBe(true);
  });

  it("maps raw expenses to SettlementExpenseRow format", async () => {
    const rawExpense = {
      _id: { toString: () => "exp1" },
      paidBy: PERSON1,
      amount: 4200,
      splitType: "split",
      settlementType: "deferred",
      where: "Publix",
      date: new Date("2026-05-15"),
      notes: "groceries",
    };

    mockFind.mockReturnValue(mockLean([rawExpense]));
    mockCalcSettlement.mockReturnValue(emptyBreakdown);
    mockCalcRunningBalance.mockReturnValue({
      totalOwed: 0,
      owedBy: PERSON1,
      owedTo: PERSON2,
    });

    await fetchRunningBalance(baseParams());

    expect(mockCalcSettlement).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          _id: "exp1",
          paidBy: PERSON1,
          amount: 4200,
          splitType: "split",
          settlementType: "deferred",
          where: "Publix",
          tags: [],
        }),
      ],
      PERSON1,
      PERSON2,
    );
  });

  it("includes reopened settlements in open months", async () => {
    mockFind.mockReturnValue(mockLean([]));
    mockCalcSettlement.mockReturnValue(emptyBreakdown);
    mockCalcRunningBalance.mockReturnValue({
      totalOwed: 0,
      owedBy: PERSON1,
      owedTo: PERSON2,
    });

    await fetchRunningBalance(
      baseParams({
        unsettledMonths: [{ month: 6, year: 2026 }],
        reopenedSettlements: [{ month: 4, year: 2026 }],
      })
    );

    // Open: 6 (viewed), 4 (reopened), 7 (current added). Other = 4 and 7.
    expect(mockFind).toHaveBeenCalledTimes(2);
  });
});
