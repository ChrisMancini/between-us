jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/expense", () => ({
  Expense: { aggregate: jest.fn() },
}));
jest.mock("@/lib/models/settlement", () => ({
  Settlement: { find: jest.fn() },
}));
jest.mock("@/lib/models/month-readiness", () => ({
  MonthReadiness: { find: jest.fn() },
}));

import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { MonthReadiness } from "@/lib/models/month-readiness";
import { getUnsettledMonthsForUser } from "../unsettled-months";

const mockAggregate = Expense.aggregate as jest.Mock;
const mockSettlementFind = Settlement.find as jest.Mock;
const mockReadinessFind = MonthReadiness.find as jest.Mock;

function mockLean(data: unknown) {
  return { lean: jest.fn().mockResolvedValue(data) };
}

interface MockDbOptions {
  expenses: Array<{ _id: { month: number; year: number } }>;
  closed?: Array<{ month: number; year: number }>;
  readiness?: Array<{ month: number; year: number; doneBy: string[] }>;
}

function setupMocks({ expenses, closed = [], readiness = [] }: MockDbOptions) {
  mockAggregate.mockResolvedValue(expenses);
  mockSettlementFind.mockReturnValue(mockLean(closed));
  mockReadinessFind.mockReturnValue(mockLean(readiness));
}

describe("getUnsettledMonthsForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 6, 6)));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns months with expenses that are not closed and not marked done by user", async () => {
    setupMocks({
      expenses: [
        { _id: { month: 5, year: 2026 } },
        { _id: { month: 6, year: 2026 } },
      ],
    });

    const result = await getUnsettledMonthsForUser("chris");
    expect(result).toEqual([
      { month: 5, year: 2026 },
      { month: 6, year: 2026 },
    ]);
  });

  it("excludes closed months", async () => {
    setupMocks({
      expenses: [
        { _id: { month: 5, year: 2026 } },
        { _id: { month: 6, year: 2026 } },
      ],
      closed: [{ month: 5, year: 2026 }],
    });

    const result = await getUnsettledMonthsForUser("chris");
    expect(result).toEqual([{ month: 6, year: 2026 }]);
  });

  it("excludes months where user is in doneBy", async () => {
    setupMocks({
      expenses: [
        { _id: { month: 5, year: 2026 } },
        { _id: { month: 6, year: 2026 } },
      ],
      readiness: [{ month: 5, year: 2026, doneBy: ["chris"] }],
    });

    const result = await getUnsettledMonthsForUser("chris");
    expect(result).toEqual([{ month: 6, year: 2026 }]);
  });

  it("keeps months where a different user is in doneBy", async () => {
    setupMocks({
      expenses: [{ _id: { month: 5, year: 2026 } }],
      readiness: [{ month: 5, year: 2026, doneBy: ["lauren"] }],
    });

    const result = await getUnsettledMonthsForUser("chris");
    expect(result).toEqual([{ month: 5, year: 2026 }]);
  });

  it("returns months sorted oldest first", async () => {
    setupMocks({
      expenses: [
        { _id: { month: 3, year: 2026 } },
        { _id: { month: 12, year: 2025 } },
        { _id: { month: 1, year: 2026 } },
      ],
    });

    const result = await getUnsettledMonthsForUser("chris");
    expect(result).toEqual([
      { month: 12, year: 2025 },
      { month: 1, year: 2026 },
      { month: 3, year: 2026 },
    ]);
  });

  it("returns empty array when all months are closed", async () => {
    setupMocks({
      expenses: [{ _id: { month: 5, year: 2026 } }],
      closed: [{ month: 5, year: 2026 }],
    });

    const result = await getUnsettledMonthsForUser("chris");
    expect(result).toEqual([]);
  });

  it("returns empty array when no expense months exist", async () => {
    setupMocks({ expenses: [] });

    const result = await getUnsettledMonthsForUser("chris");
    expect(result).toEqual([]);
  });
});
