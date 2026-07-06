import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { MonthReadiness } from "@/lib/models/month-readiness";
import { calculateSettlement, type SettlementExpenseRow } from "@/lib/settlement-calc";
import { serializeTag } from "@/lib/tag-utils";
import { getPersons } from "@/lib/persons";
import { withAuth } from "@/lib/auth-guard";
import { logActivity } from "@/lib/activity-logger";
import { formatCurrency } from "@/lib/utils";
import { createActionForSettlement } from "@/lib/action-lifecycle";
import type { ISettlement, SerializedSettlement } from "@/lib/models/settlement";

function serializeSettlement(doc: ISettlement): SerializedSettlement {
  return {
    _id: doc._id.toString(),
    month: doc.month,
    year: doc.year,
    status: doc.status ?? "closed",
    totalOwed: doc.totalOwed,
    owedBy: doc.owedBy,
    owedTo: doc.owedTo,
    closedAt: doc.closedAt.toISOString(),
    note: doc.note,
    previousTotalOwed: doc.previousTotalOwed,
    previousOwedBy: doc.previousOwedBy,
    reopenedAt: doc.reopenedAt?.toISOString(),
  };
}

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

async function fetchMonthBreakdown(month: number, year: number) {
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

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "");
  const year = parseInt(searchParams.get("year") ?? "");

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await Settlement.findOne({ month, year }).lean();

  if (existing && existing.status !== "open") {
    return NextResponse.json({
      status: "closed",
      settlement: serializeSettlement(existing as ISettlement),
    });
  }

  const { breakdown } = await fetchMonthBreakdown(month, year);

  return NextResponse.json({
    status: "open",
    breakdown,
    previousSettlement: existing
      ? {
          totalOwed: existing.totalOwed,
          owedBy: existing.owedBy,
          note: existing.note,
        }
      : null,
  });
});

// fallow-ignore-next-line complexity
export const POST = withAuth(async (req, session) => {
  const body = await req.json();
  const month = parseInt(body.month);
  const year = parseInt(body.year);
  const note = typeof body.note === "string" ? body.note.trim() || undefined : undefined;

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await Settlement.findOne({ month, year });

  if (existing && existing.status !== "open") {
    return NextResponse.json(
      { error: "Month already closed" },
      { status: 409 },
    );
  }

  const { breakdown, p1, p2 } = await fetchMonthBreakdown(month, year);

  const owedBy =
    breakdown.netOwedBy === "even" ? p1.key : breakdown.netOwedBy;
  const owedTo =
    breakdown.netOwedBy === "even"
      ? p2.key
      : breakdown.netOwedBy === p1.key
      ? p2.key
      : p1.key;

  let settlement;

  if (existing) {
    settlement = await Settlement.findByIdAndUpdate(
      existing._id,
      {
        status: "closed",
        totalOwed: breakdown.netAmount,
        owedBy,
        owedTo,
        closedAt: new Date(),
        note,
      },
      { returnDocument: "after" },
    );
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
  }

  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const owedByName = owedBy === p1.key ? p1.displayName : p2.displayName;
  const owedToName = owedTo === p1.key ? p1.displayName : p2.displayName;
  const settlementSummary = breakdown.netOwedBy === "even"
    ? `closed ${monthName} — even`
    : `closed ${monthName} — ${owedByName} owes ${owedToName} ${formatCurrency(breakdown.netAmount)}`;
  await MonthReadiness.deleteOne({ month, year });

  await logActivity(session.user.paidByKey, "settlement_close", settlementSummary, {
    month,
    year,
    totalOwed: breakdown.netAmount,
    owedBy,
    owedTo,
  });

  if (breakdown.netAmount > 0) {
    await createActionForSettlement(settlement!, session.user.paidByKey);
  }

  return NextResponse.json(
    { settlement: serializeSettlement(settlement!) },
    { status: existing ? 200 : 201 },
  );
});

export const PATCH = withAuth(async (req) => {
  const body = await req.json();
  const month = parseInt(body.month);
  const year = parseInt(body.year);

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  if (typeof body.note !== "string") {
    return NextResponse.json({ error: "Note is required" }, { status: 400 });
  }

  const trimmed = body.note.trim();

  await connectToDatabase();

  const existing = await Settlement.findOne({ month, year });

  if (!existing) {
    return NextResponse.json({ error: "No settlement found" }, { status: 404 });
  }

  const update = trimmed
    ? { $set: { note: trimmed } }
    : { $unset: { note: 1 } };

  const updated = await Settlement.findByIdAndUpdate(
    existing._id,
    update,
    { returnDocument: "after" },
  );

  return NextResponse.json({
    settlement: serializeSettlement(updated!),
  });
});
