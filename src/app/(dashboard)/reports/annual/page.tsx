import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { Settlement } from "@/lib/models/settlement";
import { getPersons } from "@/lib/persons";
import { tagPersonPipeline, trendPipeline } from "../_lib/report-queries";
import {
  buildTrendSeries,
  generateMonthEntries,
  buildSimpleTagTotals,
  computePersonSummaryFromAgg,
  computeHighlights,
} from "../_lib/report-transforms";
import { SpendingSummaryCard } from "../_components/spending-summary-card";
import { TagBreakdown } from "../_components/tag-breakdown";
import { MonthlyTrend } from "../_components/monthly-trend";
import { YearNav } from "./_components/year-nav";
import { AnnualHighlights } from "./_components/annual-highlights";
import { WhoPaysSplit } from "./_components/who-pays-split";
import {
  AnnualSettlementSummary,
  type SettlementRow,
} from "./_components/annual-settlement-summary";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function AnnualReportPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const year = parseInt(params.year ?? "") || new Date().getFullYear();

  await connectToDatabase();

  const persons = (await getPersons())!;

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [
    tagPersonAgg,
    trendAgg,
    allTags,
    biggestExpenseResult,
    topMerchantAgg,
    closedSettlements,
  ] = await Promise.all([
    Expense.aggregate<{
      _id: { tagPath: string; tagSortOrder: number; paidBy: string };
      total: number;
    }>(tagPersonPipeline({ start, end })),

    Expense.aggregate<{
      _id: { year: number; month: number; settlementType: string };
      total: number;
    }>(trendPipeline({ start, end })),

    Tag.find().sort({ sortOrder: 1 }).lean(),

    Expense.findOne({ date: { $gte: start, $lt: end } })
      .sort({ amount: -1 })
      .populate("tags")
      .lean(),

    Expense.aggregate<{
      _id: string;
      count: number;
      total: number;
    }>([
      { $match: { date: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: "$where",
          count: { $sum: 1 },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),

    Settlement.find({ year, status: "closed" }).sort({ month: 1 }).lean(),
  ]);

  const tagTotals = buildSimpleTagTotals(tagPersonAgg, allTags);
  const tagsWithSpending = tagTotals.filter((t) => t.total > 0);

  const personSummaryAgg = await Expense.aggregate<{
    _id: { settlementType: string; paidBy: string };
    total: number;
  }>([
    { $match: { date: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { settlementType: "$settlementType", paidBy: "$paidBy" },
        total: { $sum: "$amount" },
      },
    },
  ]);

  const { deferredTotal, immediateTotal, person1Total, person2Total, totalSpending } =
    computePersonSummaryFromAgg(personSummaryAgg, persons[0].key);

  const monthlyTotals = buildTrendSeries(
    trendAgg,
    generateMonthEntries(year, 1, 12)
  );

  const { biggestExpense, topMerchant, busiestMonth } = computeHighlights(
    biggestExpenseResult as Parameters<typeof computeHighlights>[0],
    topMerchantAgg,
    monthlyTotals
  );

  // ── Settlements ────────────────────────────────────────────────────────
  const settlementRows: SettlementRow[] = closedSettlements.map((s) => ({
    month: s.month,
    year: s.year,
    totalOwed: s.totalOwed,
    owedBy: s.owedBy,
    owedTo: s.owedTo,
  }));

  const hasExpenses = totalSpending > 0;

  return (
    <div className="space-y-6">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Reports
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Year in Review</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Annual spending summary and trends.
          </p>
        </div>
        <YearNav year={year} />
      </div>

      {!hasExpenses ? (
        <div className="rounded-xl border border-dashed border-primary/20 bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No expenses for {year}.
          </p>
        </div>
      ) : (
        <>
          {/* Summary card */}
          <SpendingSummaryCard
            label={String(year)}
            totalSpending={totalSpending}
            deferredTotal={deferredTotal}
            immediateTotal={immediateTotal}
            person1Total={person1Total}
            person2Total={person2Total}
            persons={persons}
          />

          {/* Highlights */}
          <AnnualHighlights
            biggestExpense={biggestExpense}
            topMerchant={topMerchant}
            busiestMonth={busiestMonth}
          />

          {/* Who pays more */}
          <WhoPaysSplit
            person1Total={person1Total}
            person2Total={person2Total}
          />

          {/* Tag breakdown */}
          <TagBreakdown
            tags={tagsWithSpending.map((t) => ({
              tagName: t.tagName,
              total: t.total,
            }))}
          />
        </>
      )}

      {/* Monthly trend (always shown) */}
      <MonthlyTrend
        months={monthlyTotals}
        selectedMonth={0}
        selectedYear={0}
      />

      {/* Annual settlement summary */}
      <AnnualSettlementSummary settlements={settlementRows} />
    </div>
  );
}
