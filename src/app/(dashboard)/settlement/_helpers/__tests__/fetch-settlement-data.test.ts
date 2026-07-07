jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/tag", () => ({}));
jest.mock("@/lib/models/expense", () => ({
  Expense: { find: jest.fn(), aggregate: jest.fn() },
}));
jest.mock("@/lib/models/settlement", () => ({
  Settlement: { findOne: jest.fn(), find: jest.fn() },
}));
jest.mock("@/lib/models/month-readiness", () => ({
  MonthReadiness: { findOne: jest.fn() },
}));
jest.mock("@/lib/persons", () => ({
  getPersons: jest.fn(),
  buildPersonMap: jest.fn(),
}));
jest.mock("@/lib/running-balance-data", () => ({
  fetchRunningBalance: jest.fn(),
}));

import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { MonthReadiness } from "@/lib/models/month-readiness";
import { getPersons, buildPersonMap } from "@/lib/persons";
import { fetchRunningBalance } from "@/lib/running-balance-data";
import {
  asMock,
  makeExpense,
  makeSettlement,
  makeReadiness,
  VALID_ID,
  VALID_ID_2,
} from "@/test/api-helpers";
import { fetchSettlementPageData } from "../fetch-settlement-data";
import type { SerializedPerson } from "@/lib/models/person";

const person1: SerializedPerson = {
  _id: "p1",
  key: "john",
  displayName: "John",
  role: "admin",
  colorIndex: 0,
};
const person2: SerializedPerson = {
  _id: "p2",
  key: "jane",
  displayName: "Jane",
  role: "user",
  colorIndex: 1,
};
const personMap = new Map<string, SerializedPerson>([
  ["john", person1],
  ["jane", person2],
]);

function setupDefaults(overrides?: {
  existing?: ReturnType<typeof makeSettlement> | null;
  reopened?: { month: number; year: number; status: string; reopenedAt: Date }[];
  expenseMonths?: { _id: { month: number; year: number } }[];
  closedSettlements?: { month: number; year: number }[];
  readiness?: ReturnType<typeof makeReadiness> | null;
  rawExpenses?: ReturnType<typeof makeExpense>[];
}) {
  const {
    existing = null,
    reopened = [],
    expenseMonths = [],
    closedSettlements = [],
    readiness = null,
    rawExpenses = [],
  } = overrides ?? {};

  asMock(getPersons).mockResolvedValue([person1, person2]);
  asMock(buildPersonMap).mockReturnValue(personMap);

  asMock(Settlement.findOne).mockReturnValue({
    lean: jest.fn().mockResolvedValue(existing),
  });
  asMock(Settlement.find)
    .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(reopened) })
    .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(closedSettlements) });
  asMock(Expense.aggregate).mockResolvedValue(expenseMonths);
  asMock(MonthReadiness.findOne).mockReturnValue({
    lean: jest.fn().mockResolvedValue(readiness),
  });

  asMock(Expense.find).mockReturnValue({
    sort: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(rawExpenses),
      }),
    }),
  });

  asMock(fetchRunningBalance).mockResolvedValue(null);
}

describe("fetchSettlementPageData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 6, 6)));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns open month fields when no settlement exists", async () => {
    setupDefaults();

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.isClosed).toBe(false);
    expect(result.closedSettlement).toBeNull();
    expect(result.previousSettlement).toBeUndefined();
    expect(result.existingNote).toBeUndefined();
  });

  it("serializes expenses with tags", async () => {
    const expense = makeExpense({
      _id: VALID_ID,
      paidBy: "john",
      amount: 5000,
      splitType: "split",
      settlementType: "deferred",
      where: "Publix",
      date: new Date(Date.UTC(2026, 3, 15)),
      tags: [{ _id: VALID_ID_2, path: "Groceries", sortOrder: 2 }],
    });
    setupDefaults({ rawExpenses: [expense] });

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.breakdown.deferredExpenses).toHaveLength(1);
    const row = result.breakdown.deferredExpenses[0];
    expect(row._id).toBe(VALID_ID);
    expect(row.paidBy).toBe("john");
    expect(row.amount).toBe(5000);
    expect(row.tags[0].path).toBe("Groceries");
  });

  it("serializes closed settlement with note", async () => {
    const closedAt = new Date(Date.UTC(2026, 3, 30));
    setupDefaults({
      existing: makeSettlement({
        status: "closed",
        totalOwed: 10000,
        owedBy: "john",
        owedTo: "jane",
        closedAt,
        note: "Paid via Zelle",
      }),
    });

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.isClosed).toBe(true);
    expect(result.closedSettlement).not.toBeNull();
    expect(result.closedSettlement!.totalOwed).toBe(10000);
    expect(result.closedSettlement!.owedBy).toBe("john");
    expect(result.closedSettlement!.closedAt).toBe(closedAt.toISOString());
    expect(result.closedSettlement!.note).toBe("Paid via Zelle");
    expect(result.existingNote).toBe("Paid via Zelle");
  });

  it("captures previous settlement for reopened months", async () => {
    setupDefaults({
      existing: makeSettlement({
        status: "open",
        previousTotalOwed: 8000,
        previousOwedBy: "jane",
        reopenedAt: new Date(),
      }),
    });

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.isClosed).toBe(false);
    expect(result.previousSettlement).toEqual({
      totalOwed: 8000,
      owedBy: "jane",
    });
  });

  it("computes unsettled months excluding closed and reopened", async () => {
    setupDefaults({
      expenseMonths: [
        { _id: { month: 1, year: 2026 } },
        { _id: { month: 2, year: 2026 } },
        { _id: { month: 3, year: 2026 } },
      ],
      closedSettlements: [{ month: 1, year: 2026 }],
      reopened: [
        { month: 3, year: 2026, status: "open", reopenedAt: new Date() },
      ],
    });

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.unsettledMonths).toEqual([{ month: 2, year: 2026 }]);
  });

  it("sorts unsettled months chronologically", async () => {
    setupDefaults({
      expenseMonths: [
        { _id: { month: 6, year: 2025 } },
        { _id: { month: 3, year: 2026 } },
        { _id: { month: 1, year: 2026 } },
      ],
    });

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.unsettledMonths).toEqual([
      { month: 6, year: 2025 },
      { month: 1, year: 2026 },
      { month: 3, year: 2026 },
    ]);
  });

  it("generates summary text when someone owes", async () => {
    const expense = makeExpense({
      amount: 10000,
      paidBy: "john",
      splitType: "split",
      settlementType: "deferred",
    });
    setupDefaults({ rawExpenses: [expense] });

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.summaryText).toContain("Jane");
    expect(result.summaryText).toContain("owes");
    expect(result.summaryText).toContain("John");
  });

  it("generates even summary text when amounts balance", async () => {
    setupDefaults();

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.summaryText).toContain("All settled");
  });

  it("filters immediate expenses separately", async () => {
    const deferred = makeExpense({
      _id: VALID_ID,
      settlementType: "deferred",
    });
    const immediate = makeExpense({
      _id: VALID_ID_2,
      settlementType: "immediate",
    });
    setupDefaults({ rawExpenses: [deferred, immediate] });

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.immediateExpenses).toHaveLength(1);
    expect(result.immediateExpenses[0]._id).toBe(VALID_ID_2);
  });

  it("passes through readiness data", async () => {
    const readiness = makeReadiness({ doneBy: ["john"] });
    setupDefaults({ readiness });

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.readiness).toEqual(readiness);
  });

  it("returns reopened settlements as month/year refs", async () => {
    setupDefaults({
      reopened: [
        { month: 2, year: 2026, status: "open", reopenedAt: new Date() },
        { month: 3, year: 2026, status: "open", reopenedAt: new Date() },
      ],
    });

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.reopenedSettlements).toEqual([
      { month: 2, year: 2026 },
      { month: 3, year: 2026 },
    ]);
  });

  it("returns existingNote from open settlement", async () => {
    setupDefaults({
      existing: makeSettlement({
        status: "open",
        note: "Will pay Friday",
      }),
    });

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.existingNote).toBe("Will pay Friday");
    expect(result.isClosed).toBe(false);
  });

  it("returns runningBalance from fetchRunningBalance", async () => {
    const mockBalance = { netOwedBy: "john", netAmount: 25000, monthCount: 3 };
    asMock(fetchRunningBalance).mockResolvedValue(mockBalance);
    setupDefaults();
    asMock(fetchRunningBalance).mockResolvedValue(mockBalance);

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.runningBalance).toEqual(mockBalance);
    expect(fetchRunningBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        viewedMonth: 4,
        viewedYear: 2026,
        person1Key: "john",
        person2Key: "jane",
      })
    );
  });

  it("returns null runningBalance when fetchRunningBalance returns null", async () => {
    setupDefaults();

    const result = await fetchSettlementPageData(4, 2026);

    expect(result.runningBalance).toBeNull();
  });
});
