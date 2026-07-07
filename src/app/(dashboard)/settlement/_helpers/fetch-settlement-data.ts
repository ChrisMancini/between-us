import mongoose from "mongoose";
import "@/lib/models/tag";
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import type { SerializedSettlement } from "@/lib/models/settlement";
import {
  calculateSettlement,
  type SettlementBreakdown,
  type SettlementExpenseRow,
  type RunningBalance,
} from "@/lib/settlement-calc";
import { fetchRunningBalance } from "@/lib/running-balance-data";
import { serializeTag } from "@/lib/tag-utils";
import { getPersons, buildPersonMap } from "@/lib/persons";
import type { SerializedPerson } from "@/lib/models/person";
import { formatCurrency, getMonthDateRange } from "@/lib/utils";
import { MonthReadiness } from "@/lib/models/month-readiness";
import type { IMonthReadiness } from "@/lib/models/month-readiness";

interface MonthRef {
  month: number;
  year: number;
}

export interface SettlementPageData {
  persons: [SerializedPerson, SerializedPerson];
  personMap: Map<string, SerializedPerson>;
  breakdown: SettlementBreakdown;
  closedSettlement: SerializedSettlement | null;
  isClosed: boolean;
  previousSettlement: { totalOwed: number; owedBy: string } | undefined;
  summaryText: string;
  immediateExpenses: SettlementExpenseRow[];
  reopenedSettlements: MonthRef[];
  unsettledMonths: MonthRef[];
  readiness: IMonthReadiness | null;
  existingNote?: string;
  runningBalance: RunningBalance | null;
}

export async function fetchSettlementPageData(
  month: number,
  year: number
): Promise<SettlementPageData> {
  const persons = (await getPersons())!;
  const [p1, p2] = persons;
  const personMap = buildPersonMap(persons);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [existing, reopenedSettlements, expenseMonths, closedSettlements, readiness] =
    await Promise.all([
      Settlement.findOne({ month, year }).lean(),
      Settlement.find(
        { status: "open", reopenedAt: { $exists: true } },
        { month: 1, year: 1, _id: 0 }
      ).lean(),
      Expense.aggregate<{ _id: { month: number; year: number } }>([
        {
          $match: {
            date: { $lt: new Date(Date.UTC(currentYear, currentMonth - 1, 1)) },
          },
        },
        {
          $group: {
            _id: {
              month: { $month: "$date" },
              year: { $year: "$date" },
            },
          },
        },
      ]),
      Settlement.find(
        { status: "closed" },
        { month: 1, year: 1, _id: 0 }
      ).lean(),
      MonthReadiness.findOne({ month, year }).lean(),
    ]);

  const closedSet = new Set(
    closedSettlements.map((s) => `${s.year}-${s.month}`)
  );
  const reopenedSet = new Set(
    reopenedSettlements.map((s) => `${s.year}-${s.month}`)
  );
  const unsettledMonths = expenseMonths
    .map((e) => e._id)
    .filter(
      (m) =>
        !closedSet.has(`${m.year}-${m.month}`) &&
        !reopenedSet.has(`${m.year}-${m.month}`)
    )
    .sort((a, b) => a.year - b.year || a.month - b.month);

  const { start, end } = getMonthDateRange(month, year);

  const rawExpenses = await Expense.find({
    date: { $gte: start, $lt: end },
  })
    .sort({ date: 1, createdAt: 1 })
    .populate("tags")
    .lean();

  const expenses: SettlementExpenseRow[] = (
    rawExpenses as unknown as Record<string, unknown>[]
  ).map((e) => {
    const rawTags = (e.tags as Record<string, unknown>[] | undefined) ?? [];
    return {
      _id: (e._id as mongoose.Types.ObjectId).toString(),
      paidBy: e.paidBy as string,
      amount: e.amount as number,
      splitType: e.splitType as "split" | "full",
      settlementType: e.settlementType as "immediate" | "deferred",
      where: e.where as string,
      date: (e.date as Date).toISOString(),
      tags: rawTags.map((t) =>
        serializeTag(t as { _id: unknown; path: string; sortOrder: number })
      ),
      notes: e.notes as string | undefined,
    };
  });

  const breakdown = calculateSettlement(expenses, p1.key, p2.key);

  const closedSettlement: SerializedSettlement | null =
    existing && existing.status !== "open"
      ? {
          _id: existing._id.toString(),
          month: existing.month,
          year: existing.year,
          status: (existing.status ?? "closed") as "open" | "closed",
          totalOwed: existing.totalOwed,
          owedBy: existing.owedBy,
          owedTo: existing.owedTo,
          closedAt: existing.closedAt.toISOString(),
          note: existing.note,
          previousTotalOwed: existing.previousTotalOwed,
          previousOwedBy: existing.previousOwedBy,
          reopenedAt: existing.reopenedAt?.toISOString(),
        }
      : null;

  const isClosed = !!closedSettlement;

  const previousSettlement =
    existing && existing.status === "open" &&
    existing.previousTotalOwed !== undefined &&
    existing.previousOwedBy !== undefined
      ? {
          totalOwed: existing.previousTotalOwed,
          owedBy: existing.previousOwedBy as string,
        }
      : undefined;

  const reopenedMonthRefs = reopenedSettlements.map((s) => ({ month: s.month, year: s.year }));

  const runningBalance = await fetchRunningBalance({
    unsettledMonths,
    reopenedSettlements: reopenedMonthRefs,
    closedSet,
    currentMonth,
    currentYear,
    viewedMonth: month,
    viewedYear: year,
    isClosed,
    viewedBreakdown: breakdown,
    person1Key: p1.key,
    person2Key: p2.key,
  });

  function netSummaryText(owedBy: string, amount: number) {
    if (owedBy === "even") return "All settled — no money changes hands";
    const payer = personMap.get(owedBy)?.displayName ?? owedBy;
    const receiver =
      [...personMap.values()].find((p) => p.key !== owedBy)?.displayName ?? "";
    return `${payer} owes ${receiver} ${formatCurrency(amount)}`;
  }

  const summaryText = isClosed
    ? netSummaryText(closedSettlement!.owedBy, closedSettlement!.totalOwed)
    : netSummaryText(breakdown.netOwedBy, breakdown.netAmount);

  const immediateExpenses = expenses.filter(
    (e) => e.settlementType === "immediate"
  );

  return {
    persons,
    personMap,
    breakdown,
    closedSettlement,
    isClosed,
    previousSettlement,
    summaryText,
    immediateExpenses,
    reopenedSettlements: reopenedMonthRefs,
    unsettledMonths,
    readiness,
    existingNote: existing?.note,
    runningBalance,
  };
}
