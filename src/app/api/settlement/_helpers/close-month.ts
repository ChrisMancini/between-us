import mongoose from "mongoose";
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { MonthReadiness } from "@/lib/models/month-readiness";
import { calculateSettlement, type SettlementExpenseRow } from "@/lib/settlement-calc";
import { serializeTag } from "@/lib/tag-utils";
import { getPersons } from "@/lib/persons";
import { logActivity } from "@/lib/activity-logger";
import { formatCurrency } from "@/lib/utils";
import { createActionForSettlement } from "@/lib/action-lifecycle";
import type { ISettlement } from "@/lib/models/settlement";

function serializeExpenseRow(e: Record<string, unknown>): SettlementExpenseRow | null {
  const tags = e.tags as Array<Record<string, unknown>> | null;
  if (!tags || tags.length === 0) return null;
  return {
    _id: (e._id as mongoose.Types.ObjectId).toString(),
    paidBy: e.paidBy as string,
    amount: e.amount as number,
    splitType: e.splitType as "split" | "full",
    settlementType: e.settlementType as "immediate" | "deferred",
    where: e.where as string,
    date: (e.date as Date).toISOString(),
    tags: tags.map((t) =>
      serializeTag(t as { _id: unknown; path: string; sortOrder: number }),
    ),
  };
}

export async function fetchMonthBreakdown(month: number, year: number) {
  const persons = await getPersons();
  const [p1, p2] = persons!;

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const expenses = await Expense.find({
    date: { $gte: start, $lt: end },
  })
    .populate("tags")
    .lean();

  const rows = (expenses as unknown as Record<string, unknown>[])
    .map(serializeExpenseRow)
    .filter((r): r is SettlementExpenseRow => r !== null);
  const breakdown = calculateSettlement(rows, p1.key, p2.key);

  return { breakdown, p1, p2 };
}

export async function closeMonth(
  month: number,
  year: number,
  note: string | undefined,
  userKey: string,
  existingId?: string,
): Promise<{ settlement: ISettlement; isNew: boolean }> {
  const { breakdown, p1, p2 } = await fetchMonthBreakdown(month, year);

  const owedBy =
    breakdown.netOwedBy === "even" ? p1.key : breakdown.netOwedBy;
  const owedTo =
    breakdown.netOwedBy === "even"
      ? p2.key
      : breakdown.netOwedBy === p1.key
      ? p2.key
      : p1.key;

  let settlement: ISettlement;
  let isNew: boolean;

  if (existingId) {
    settlement = (await Settlement.findByIdAndUpdate(
      existingId,
      {
        status: "closed",
        totalOwed: breakdown.netAmount,
        owedBy,
        owedTo,
        closedAt: new Date(),
        note,
      },
      { returnDocument: "after" },
    ))!;
    isNew = false;
  } else {
    settlement = await Settlement.create({
      month,
      year,
      status: "closed",
      totalOwed: breakdown.netAmount,
      owedBy,
      owedTo,
      closedAt: new Date(),
      note,
    });
    isNew = true;
  }

  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const owedByName = owedBy === p1.key ? p1.displayName : p2.displayName;
  const owedToName = owedTo === p1.key ? p1.displayName : p2.displayName;
  const settlementSummary = breakdown.netOwedBy === "even"
    ? `closed ${monthName} — even`
    : `closed ${monthName} — ${owedByName} owes ${owedToName} ${formatCurrency(breakdown.netAmount)}`;

  await MonthReadiness.deleteOne({ month, year });

  await logActivity(userKey, "settlement_close", settlementSummary, {
    month,
    year,
    totalOwed: breakdown.netAmount,
    owedBy,
    owedTo,
  });

  if (breakdown.netAmount > 0) {
    await createActionForSettlement(settlement, userKey);
  }

  return { settlement, isNew };
}
