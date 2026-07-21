import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { formatMonthYear, parseMonthYearParams } from "@/lib/utils";
import { MonthNav } from "@/components/month-nav";
import { CloseMonthDialog } from "./_components/close-month-dialog";
import { ReopenMonthDialog } from "./_components/reopen-month-dialog";
import { ReadinessStatus } from "./_components/readiness-status";
import { SettlementAlerts } from "./_components/settlement-alerts";
import { NetResultCard } from "./_components/net-result-card";
import { ExpenseTable } from "./_components/expense-table";
import { fetchSettlementPageData } from "./_helpers/fetch-settlement-data";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function SettlementPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");

  const { month, year } = parseMonthYearParams(await searchParams);

  await connectToDatabase();

  const {
    persons,
    personMap,
    breakdown,
    closedSettlement,
    isClosed,
    previousSettlement,
    summaryText,
    immediateExpenses,
    reopenedSettlements,
    unsettledMonths,
    readiness,
    existingNote,
    runningBalance,
  } = await fetchSettlementPageData(month, year);

  const [p1, p2] = persons;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

        <div className="flex flex-wrap items-center gap-3">
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
                existingNote={existingNote}
                disabled={(readiness?.doneBy?.length ?? 0) < 2}
              />
            )
          )}
          <MonthNav month={month} year={year} basePath="/settlement" />
        </div>
      </div>

      <SettlementAlerts
        reopenedSettlements={reopenedSettlements}
        unsettledMonths={unsettledMonths}
        closedSettlement={closedSettlement}
        isClosed={isClosed}
        month={month}
        year={year}
      />

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
        owedBy={isClosed ? closedSettlement!.owedBy : breakdown.netOwedBy}
        amount={isClosed ? closedSettlement!.totalOwed : breakdown.netAmount}
        person1OwesPerson2={breakdown.person1OwesPerson2}
        person2OwesPerson1={breakdown.person2OwesPerson1}
        person1={p1}
        person2={p2}
        personMap={personMap}
        label={formatMonthYear(month, year)}
        note={isClosed ? closedSettlement!.note : existingNote}
        month={month}
        year={year}
        isClosed={isClosed}
        runningBalance={runningBalance}
      />

      {/* Deferred expense breakdown */}
      {breakdown.deferredExpenses.length > 0 ? (
        <ExpenseTable
          expenses={breakdown.deferredExpenses}
          title="Settled Monthly"
          description="These expenses are included in the settlement calculation."
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
        />
      )}
    </div>
  );
}
