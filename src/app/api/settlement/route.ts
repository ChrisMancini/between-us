import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { MonthReadiness } from "@/lib/models/month-readiness";
import { calculateSettlement, type SettlementExpenseRow } from "@/lib/settlement-calc";
import { getPersons } from "@/lib/persons";
import { withAuth } from "@/lib/auth-guard";
import { logActivity } from "@/lib/activity-logger";
import { formatCurrency } from "@/lib/utils";

function serializeExpenseRow(e: Record<string, unknown>): SettlementExpenseRow | null {
  const cat = e.category as Record<string, unknown> | null;
  if (!cat) return null;
  return {
    _id: (e._id as mongoose.Types.ObjectId).toString(),
    paidBy: e.paidBy as string,
    amount: e.amount as number,
    splitType: e.splitType as "split" | "full",
    where: e.where as string,
    date: (e.date as Date).toISOString(),
    category: {
      _id: (cat._id as mongoose.Types.ObjectId).toString(),
      name: cat.name as string,
      settlementType: cat.settlementType as "immediate" | "deferred",
      sortOrder: cat.sortOrder as number,
    },
  };
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
      settlement: {
        _id: existing._id.toString(),
        month: existing.month,
        year: existing.year,
        status: existing.status ?? "closed",
        totalOwed: existing.totalOwed,
        owedBy: existing.owedBy,
        owedTo: existing.owedTo,
        closedAt: existing.closedAt.toISOString(),
        previousTotalOwed: existing.previousTotalOwed,
        previousOwedBy: existing.previousOwedBy,
        reopenedAt: existing.reopenedAt?.toISOString(),
      },
    });
  }

  const persons = await getPersons();
  const [p1, p2] = persons!;

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const expenses = await Expense.find({
    date: { $gte: start, $lt: end },
  })
    .populate("category")
    .lean();

  const rows = (expenses as unknown as Record<string, unknown>[])
    .map(serializeExpenseRow)
    .filter((r): r is SettlementExpenseRow => r !== null);
  const breakdown = calculateSettlement(rows, p1.key, p2.key);

  return NextResponse.json({
    status: "open",
    breakdown,
    previousSettlement: existing
      ? {
          totalOwed: existing.totalOwed,
          owedBy: existing.owedBy,
        }
      : null,
  });
});

export const POST = withAuth(async (req, session) => {
  const body = await req.json();
  const month = parseInt(body.month);
  const year = parseInt(body.year);

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await Settlement.findOne({ month, year });

  if (existing && existing.status !== "open") {
    return NextResponse.json(
      { error: "Month already closed" },
      { status: 409 }
    );
  }

  const persons = await getPersons();
  const [p1, p2] = persons!;

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const expenses = await Expense.find({
    date: { $gte: start, $lt: end },
  })
    .populate("category")
    .lean();

  const rows = (expenses as unknown as Record<string, unknown>[])
    .map(serializeExpenseRow)
    .filter((r): r is SettlementExpenseRow => r !== null);
  const breakdown = calculateSettlement(rows, p1.key, p2.key);

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
      },
      { returnDocument: "after" }
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

  return NextResponse.json(
    {
      settlement: {
        _id: settlement!._id.toString(),
        month: settlement!.month,
        year: settlement!.year,
        status: settlement!.status,
        totalOwed: settlement!.totalOwed,
        owedBy: settlement!.owedBy,
        owedTo: settlement!.owedTo,
        closedAt: settlement!.closedAt.toISOString(),
        previousTotalOwed: settlement!.previousTotalOwed,
        previousOwedBy: settlement!.previousOwedBy,
      },
    },
    { status: existing ? 200 : 201 }
  );
});
