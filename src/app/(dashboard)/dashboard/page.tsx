import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { getPersons } from "@/lib/persons";
import { formatMonthYear, getMonthDateRange } from "@/lib/utils";
import {
  calculateSettlement,
  type SettlementExpenseRow,
} from "@/lib/settlement-calc";
import { serializeTag } from "@/lib/tag-utils";
import { Activity, type IActivity } from "@/lib/models/activity";
import { Action } from "@/lib/models/action";
import type { SerializedAction } from "@/lib/models/action";
import { UserPreference } from "@/lib/models/user-preference";
import { mergeWidgetPreferences } from "@/lib/widget-preferences";
import { SpendingSummaryCard } from "../reports/_components/spending-summary-card";
import { RecentExpenses } from "./_components/recent-expenses";
import { DashboardWidgetColumn } from "./_components/dashboard-widget-column";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const { start, end } = getMonthDateRange(month, year);

  await connectToDatabase();

  const persons = (await getPersons())!;

  const [
    spendingAgg,
    settlementRecord,
    recentRaw,
    expenseMonths,
    closedSettlements,
    currentMonthExpensesRaw,
    recentActivitiesRaw,
    activeActionsRaw,
    userPreferenceDoc,
  ] = await Promise.all([
    // 1. Current month spending by settlement type × person
    Expense.aggregate<{
      _id: {
        settlementType: "immediate" | "deferred";
        paidBy: string;
      };
      total: number;
    }>([
      { $match: { date: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: {
            settlementType: "$settlementType",
            paidBy: "$paidBy",
          },
          total: { $sum: "$amount" },
        },
      },
    ]),

    // 2. Settlement record for current month
    Settlement.findOne({ month, year }).lean(),

    // 3. Recent 10 expenses (any month)
    Expense.find()
      .sort({ date: -1, createdAt: -1 })
      .limit(10)
      .populate("tags")
      .lean(),

    // 4. Distinct expense months before current month (for unsettled check)
    Expense.aggregate<{ _id: { month: number; year: number } }>([
      {
        $match: {
          date: { $lt: new Date(Date.UTC(year, month - 1, 1)) },
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

    // 5. All closed settlements
    Settlement.find(
      { status: "closed" },
      { month: 1, year: 1, _id: 0 }
    ).lean(),

    // 6. Current month expenses for settlement calculation
    Expense.find({ date: { $gte: start, $lt: end } })
      .sort({ date: 1, createdAt: 1 })
      .populate("tags")
      .lean(),

    // 7. Recent partner activity for widget
    Activity.find({ actorKey: { $ne: session.user.paidByKey } })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean<IActivity[]>(),

    // 8. Active actions for current user
    Action.find({
      $or: [
        { debtorKey: session.user.paidByKey },
        { creditorKey: session.user.paidByKey },
      ],
      status: { $in: ["pending", "paid"] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),

    // 9. User widget preferences
    UserPreference.findOne({ userId: session.user.id }).lean(),
  ]);

  // ── Spending summary totals ───────────────────────────────────────────
  let deferredTotal = 0;
  let immediateTotal = 0;
  let person1Total = 0;
  let person2Total = 0;

  for (const row of spendingAgg) {
    if (row._id.settlementType === "deferred") {
      deferredTotal += row.total;
    } else {
      immediateTotal += row.total;
    }
    if (row._id.paidBy === persons[0].key) {
      person1Total += row.total;
    } else {
      person2Total += row.total;
    }
  }

  const totalSpending = deferredTotal + immediateTotal;

  // ── Settlement status ─────────────────────────────────────────────────
  const isClosed =
    !!settlementRecord && settlementRecord.status !== "open";

  const expenses: SettlementExpenseRow[] = (
    currentMonthExpensesRaw as unknown as Record<string, unknown>[]
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
    };
  });

  const [p1, p2] = persons;
  const breakdown = calculateSettlement(expenses, p1.key, p2.key);

  const netOwedBy = isClosed
    ? settlementRecord!.owedBy === settlementRecord!.owedTo
      ? "even" as const
      : (settlementRecord!.owedBy as string)
    : breakdown.netOwedBy;

  const netAmount = isClosed
    ? settlementRecord!.totalOwed
    : breakdown.netAmount;

  // ── Unsettled past months ─────────────────────────────────────────────
  const closedSet = new Set(
    closedSettlements.map((s) => `${s.year}-${s.month}`)
  );
  const unsettledMonthCount = expenseMonths
    .map((e) => e._id)
    .filter((m) => !closedSet.has(`${m.year}-${m.month}`)).length;

  // ── Recent expenses ───────────────────────────────────────────────────
  const recentExpenses = (
    recentRaw as unknown as Record<string, unknown>[]
  ).map((e) => {
    const rawTags = (e.tags as Record<string, unknown>[] | undefined) ?? [];
    const tagNames = rawTags
      .map((t) => (t as { path: string }).path)
      .join(", ");
    return {
      date: (e.date as Date).toISOString(),
      where: e.where as string,
      tagNames: tagNames || "Untagged",
      paidBy: e.paidBy as string,
      amount: e.amount as number,
      notes: e.notes as string | undefined,
      splitType: e.splitType as "split" | "full",
      settlementType: e.settlementType as "immediate" | "deferred",
    };
  });

  // ── Recent partner activity ────────────────────────────────────────────
  const recentActivities = recentActivitiesRaw.map((a) => ({
    _id: a._id.toString(),
    action: a.action,
    actorKey: a.actorKey,
    summary: a.summary,
    metadata: JSON.parse(JSON.stringify(a.metadata ?? {})) as Record<string, unknown>,
    createdAt: (a.createdAt as Date).toISOString(),
  }));

  // ── Active actions ─────────────────────────────────────────────────────
  const activeActions: SerializedAction[] = (activeActionsRaw as unknown as Array<Record<string, unknown>>).map((a) => ({
    _id: String(a._id),
    sourceType: a.sourceType as SerializedAction["sourceType"],
    sourceId: String(a.sourceId),
    debtorKey: a.debtorKey as string,
    creditorKey: a.creditorKey as string,
    amount: a.amount as number,
    status: a.status as SerializedAction["status"],
    cancelReason: a.cancelReason as string | undefined,
    description: a.description as string,
    paidAt: (a.paidAt as Date | undefined)?.toISOString(),
    confirmedAt: (a.confirmedAt as Date | undefined)?.toISOString(),
    cancelledAt: (a.cancelledAt as Date | undefined)?.toISOString(),
    createdAt: (a.createdAt as Date).toISOString(),
    updatedAt: (a.updatedAt as Date).toISOString(),
  }));

  // ── Widget preferences ──────────────────────────────────────────────
  const userPref = userPreferenceDoc as { dashboard?: { widgets?: Array<{ widgetId: string; collapsed: boolean }> } } | null;
  const widgetPreferences = mergeWidgetPreferences(userPref?.dashboard?.widgets);

  const hasExpenses = totalSpending > 0;
  const label = formatMonthYear(month, year);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          At a glance — {label}
        </p>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — spending + recent */}
        <div className="lg:col-span-2 space-y-6">
          {hasExpenses ? (
            <SpendingSummaryCard
              label={label}
              totalSpending={totalSpending}
              deferredTotal={deferredTotal}
              immediateTotal={immediateTotal}
              person1Total={person1Total}
              person2Total={person2Total}
              persons={persons}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-primary/20 bg-card py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No expenses yet for {label}.
              </p>
            </div>
          )}

          <RecentExpenses expenses={recentExpenses} />
        </div>

        {/* Right column — draggable widgets */}
        <DashboardWidgetColumn
          widgetPreferences={widgetPreferences}
          settlementProps={{
            monthLabel: label,
            isClosed,
            netOwedBy,
            netAmount,
            unsettledMonthCount,
          }}
          activities={recentActivities}
          actions={activeActions}
          currentUserKey={session.user.paidByKey}
        />
      </div>
    </div>
  );
}
