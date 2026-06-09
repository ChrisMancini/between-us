import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PersonBadge } from "@/components/person-badge";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import "@/lib/models/tag";
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import type { SerializedSettlement } from "@/lib/models/settlement";
import {
  calculateSettlement,
  type SettlementExpenseRow,
} from "@/lib/settlement-calc";
import { serializeTag } from "@/lib/tag-utils";
import { getPersons, buildPersonMap, badgeProps } from "@/lib/persons";
import type { SerializedPerson } from "@/lib/models/person";
import { formatCurrency, formatMonthYear, parseMonthYearParams, getMonthDateRange } from "@/lib/utils";
import { MonthNav } from "@/components/month-nav";
import { CloseMonthDialog } from "./_components/close-month-dialog";
import { ReopenMonthDialog } from "./_components/reopen-month-dialog";
import { ReadinessStatus } from "./_components/readiness-status";
import { MonthReadiness } from "@/lib/models/month-readiness";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function SettlementPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");

  const { month, year } = parseMonthYearParams(await searchParams);

  await connectToDatabase();

  const persons = (await getPersons())!;
  const [p1, p2] = persons;
  const personMap = buildPersonMap(persons);

  // Check if already closed + find reopened months + find unsettled past months
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
      // Distinct month/year combos that have expenses before the current month
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
      // All settlements that are closed
      Settlement.find(
        { status: "closed" },
        { month: 1, year: 1, _id: 0 }
      ).lean(),
      // Readiness flags for this month
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

  // Always load expenses for the breakdown table
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
          previousTotalOwed: existing.previousTotalOwed,
          previousOwedBy: existing.previousOwedBy,
          reopenedAt: existing.reopenedAt?.toISOString(),
        }
      : null;

  const isClosed = !!closedSettlement;

  // If the month was reopened, capture previous settlement values for the re-close dialog
  const previousSettlement =
    existing && existing.status === "open" &&
    existing.previousTotalOwed !== undefined &&
    existing.previousOwedBy !== undefined
      ? {
          totalOwed: existing.previousTotalOwed,
          owedBy: existing.previousOwedBy as string,
        }
      : undefined;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settlement</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monthly close-out between {p1.displayName} and {p2.displayName}
          </p>
          <Link
            href="/settlement/history"
            className="text-sm text-primary hover:underline underline-offset-2 mt-1 inline-block"
          >
            View history
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {isClosed ? (
            <ReopenMonthDialog
              month={month}
              year={year}
              monthLabel={formatMonthYear(month, year)}
            />
          ) : (
            breakdown.deferredExpenses.length > 0 && (
              <CloseMonthDialog
                month={month}
                year={year}
                summary={summaryText}
                newTotalOwed={breakdown.netAmount}
                newOwedBy={breakdown.netOwedBy}
                previous={previousSettlement}
                disabled={(readiness?.doneBy?.length ?? 0) < 2}
              />
            )
          )}
          <MonthNav month={month} year={year} basePath="/settlement" />
        </div>
      </div>

      {/* Reopened months alert */}
      {reopenedSettlements.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {reopenedSettlements.length === 1
                ? "A month has been reopened"
                : `${reopenedSettlements.length} months have been reopened`}
            </span>
            <span className="text-amber-700 dark:text-amber-400"> — </span>
            {reopenedSettlements.map((s, i) => {
              const isCurrentView = s.month === month && s.year === year;
              return (
                <span key={`${s.year}-${s.month}`}>
                  {i > 0 && ", "}
                  {isCurrentView ? (
                    <span className="font-medium text-amber-800 dark:text-amber-300">
                      {formatMonthYear(s.month, s.year)}
                    </span>
                  ) : (
                    <Link
                      href={`/settlement?month=${s.month}&year=${s.year}`}
                      className="font-medium text-amber-800 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
                    >
                      {formatMonthYear(s.month, s.year)}
                    </Link>
                  )}
                </span>
              );
            })}
          </div>
          <Badge
            variant="outline"
            className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 font-medium shrink-0"
          >
            Needs attention
          </Badge>
        </div>
      )}

      {/* Unsettled past months alert */}
      {unsettledMonths.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-orange-800 dark:text-orange-300">
              {unsettledMonths.length === 1
                ? "A past month hasn\u2019t been closed"
                : `${unsettledMonths.length} past months haven\u2019t been closed`}
            </span>
            <span className="text-orange-700 dark:text-orange-400"> — </span>
            {unsettledMonths.map((m, i) => {
              const isCurrentView = m.month === month && m.year === year;
              return (
                <span key={`${m.year}-${m.month}`}>
                  {i > 0 && ", "}
                  {isCurrentView ? (
                    <span className="font-medium text-orange-800 dark:text-orange-300">
                      {formatMonthYear(m.month, m.year)}
                    </span>
                  ) : (
                    <Link
                      href={`/settlement?month=${m.month}&year=${m.year}`}
                      className="font-medium text-orange-800 dark:text-orange-300 underline underline-offset-2 hover:text-orange-900 dark:hover:text-orange-200"
                    >
                      {formatMonthYear(m.month, m.year)}
                    </Link>
                  )}
                </span>
              );
            })}
          </div>
          <Badge
            variant="outline"
            className="border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400 font-medium shrink-0"
          >
            Not closed
          </Badge>
        </div>
      )}

      {/* Status banner */}
      {isClosed && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              Month closed
            </span>
            <span className="text-emerald-700 dark:text-emerald-400">
              {" "}
              — settled on{" "}
              {new Date(closedSettlement!.closedAt).toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" }
              )}
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 font-medium"
          >
            Closed
          </Badge>
        </div>
      )}

      {/* Readiness status */}
      {!isClosed && breakdown.deferredExpenses.length > 0 && (
        <ReadinessStatus
          key={`${year}-${month}`}
          month={month}
          year={year}
          doneBy={readiness?.doneBy ?? []}
          persons={persons}
          currentUserKey={session.user.paidByKey}
        />
      )}

      {/* Net result card */}
      <NetResultCard
        owedBy={
          isClosed ? closedSettlement!.owedBy : breakdown.netOwedBy
        }
        amount={
          isClosed ? closedSettlement!.totalOwed : breakdown.netAmount
        }
        person1OwesPerson2={breakdown.person1OwesPerson2}
        person2OwesPerson1={breakdown.person2OwesPerson1}
        person1={p1}
        person2={p2}
        personMap={personMap}
        label={formatMonthYear(month, year)}
      />

      {/* Deferred expense breakdown */}
      {breakdown.deferredExpenses.length > 0 ? (
        <ExpenseTable
          expenses={breakdown.deferredExpenses}
          title="Settled Monthly"
          description="These expenses are included in the settlement calculation."
          personMap={personMap}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-primary/20 bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No deferred expenses for {formatMonthYear(month, year)}.
          </p>
        </div>
      )}

      {/* Immediate expenses (shown separately, not in settlement) */}
      {immediateExpenses.length > 0 && (
        <ExpenseTable
          expenses={immediateExpenses}
          title="Settled Immediately"
          description="These expenses are paid directly and excluded from the monthly settlement."
          muted
          personMap={personMap}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NetResultCard({
  owedBy,
  amount,
  person1OwesPerson2,
  person2OwesPerson1,
  person1,
  person2,
  personMap,
  label,
}: {
  owedBy: string;
  amount: number;
  person1OwesPerson2: number;
  person2OwesPerson1: number;
  person1: SerializedPerson;
  person2: SerializedPerson;
  personMap: Map<string, SerializedPerson>;
  label: string;
}) {
  const isEven = owedBy === "even";
  const payer = personMap.get(owedBy)?.displayName ?? owedBy;
  const receiver = isEven
    ? ""
    : [...personMap.values()].find((p) => p.key !== owedBy)?.displayName ?? "";

  return (
    <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Net Settlement — {label}
        </p>
      </div>

      <div className="px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Big number */}
        <div className="flex-1">
          {isEven ? (
            <div className="flex items-center gap-2">
              <Minus className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold text-muted-foreground">
                All settled
              </span>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-3xl font-bold text-foreground">{formatCurrency(amount)}</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{payer}</span>{" "}
                owes{" "}
                <span className="font-medium text-foreground">{receiver}</span>
              </p>
            </div>
          )}
        </div>

        {/* Breakdown */}
        <div className="flex gap-6 shrink-0">
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary/70" />
              <span className="text-xs font-semibold uppercase tracking-wide text-primary/70">
                {person2.displayName} → {person1.displayName}
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(person2OwesPerson1)}</p>
          </div>
          <div className="w-px bg-primary/10 self-stretch" />
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                {person1.displayName} → {person2.displayName}
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(person1OwesPerson2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseTable({
  expenses,
  title,
  description,
  muted = false,
  personMap,
}: {
  expenses: SettlementExpenseRow[];
  title: string;
  description: string;
  muted?: boolean;
  personMap: Map<string, SerializedPerson>;
}) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className={`rounded-xl border overflow-hidden shadow-sm ${muted ? "border-border opacity-70" : "border-primary/10"} bg-card`}>
      <div className={`border-b px-5 py-3 flex items-center justify-between ${muted ? "border-border bg-muted/60" : "border-primary/10 bg-primary/5"}`}>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${muted ? "text-muted-foreground" : "text-primary/70"}`}>
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(total)}
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Date</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Where</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Tags</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Paid by</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Split</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {expenses.map((e) => (
            <tr key={e._id} className="hover:bg-muted/60 transition-colors">
              <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                {new Date(e.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </td>
              <td className="px-4 py-2.5 font-medium text-foreground">{e.where}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{e.tags.map((t) => t.path).join(", ")}</td>
              <td className="px-4 py-2.5">
                <PersonBadge {...badgeProps(e.paidBy, personMap)} />
              </td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">
                {e.splitType === "split" ? "50 / 50" : "Full"}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                {formatCurrency(e.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
