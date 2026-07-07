import mongoose from "mongoose";
import { Expense } from "@/lib/models/expense";
import {
  calculateSettlement,
  calculateRunningBalance,
  type SettlementBreakdown,
  type SettlementExpenseRow,
  type RunningBalance,
} from "@/lib/settlement-calc";
import { getMonthDateRange } from "@/lib/utils";

interface FetchRunningBalanceParams {
  unsettledMonths: { month: number; year: number }[];
  reopenedSettlements: { month: number; year: number }[];
  closedSet: Set<string>;
  currentMonth: number;
  currentYear: number;
  viewedMonth: number;
  viewedYear: number;
  isClosed: boolean;
  viewedBreakdown: SettlementBreakdown;
  person1Key: string;
  person2Key: string;
}

export async function fetchRunningBalance({
  unsettledMonths,
  reopenedSettlements,
  closedSet,
  currentMonth,
  currentYear,
  viewedMonth,
  viewedYear,
  isClosed,
  viewedBreakdown,
  person1Key,
  person2Key,
}: FetchRunningBalanceParams): Promise<RunningBalance | null> {
  const allOpenMonths: { month: number; year: number }[] = [
    ...unsettledMonths,
    ...reopenedSettlements,
  ];
  const openKeys = new Set(allOpenMonths.map((m) => `${m.year}-${m.month}`));
  const currentKey = `${currentYear}-${currentMonth}`;
  if (!openKeys.has(currentKey) && !closedSet.has(currentKey)) {
    allOpenMonths.push({ month: currentMonth, year: currentYear });
  }

  if (isClosed || allOpenMonths.length < 2) {
    return null;
  }

  const viewedKey = `${viewedYear}-${viewedMonth}`;
  const viewedIsOpen = allOpenMonths.some(
    (m) => `${m.year}-${m.month}` === viewedKey
  );

  const otherMonths = allOpenMonths.filter(
    (m) => `${m.year}-${m.month}` !== viewedKey
  );

  const otherBreakdowns = await Promise.all(
    otherMonths.map(async (m) => {
      const range = getMonthDateRange(m.month, m.year);
      const rawExps = await Expense.find({
        date: { $gte: range.start, $lt: range.end },
      }).lean();
      const exps: SettlementExpenseRow[] = (
        rawExps as unknown as Record<string, unknown>[]
      ).map((e) => ({
        _id: (e._id as mongoose.Types.ObjectId).toString(),
        paidBy: e.paidBy as string,
        amount: e.amount as number,
        splitType: e.splitType as "split" | "full",
        settlementType: e.settlementType as "immediate" | "deferred",
        where: e.where as string,
        date: (e.date as Date).toISOString(),
        tags: [],
        notes: e.notes as string | undefined,
      }));
      return calculateSettlement(exps, person1Key, person2Key);
    })
  );

  const allBreakdowns = viewedIsOpen
    ? [viewedBreakdown, ...otherBreakdowns]
    : otherBreakdowns;

  return calculateRunningBalance(allBreakdowns, person1Key, person2Key);
}
