import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { LiveRegion } from "@/components/a11y/live-region";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { getPersons } from "@/lib/persons";
import { formatMonthYear, parseMonthYearParams, getMonthDateRange } from "@/lib/utils";
import { MonthNav } from "@/components/month-nav";
import { tagPersonPipeline, trendPipeline } from "./_lib/report-queries";
import {
  buildTrendSeries,
  generateMonthEntries,
  buildTagTotals,
  groupExpensesByTag,
  computePersonSummary,
} from "./_lib/report-transforms";
import { SpendingSummaryCard } from "./_components/spending-summary-card";
import { TagBreakdown } from "./_components/tag-breakdown";
import { PersonTagMatrix } from "./_components/person-tag-matrix";
import { MonthlyTrend } from "./_components/monthly-trend";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");

  const { month, year } = parseMonthYearParams(await searchParams);

  await connectToDatabase();

  const persons = (await getPersons())!;

  const { start, end } = getMonthDateRange(month, year);

  // 6-month trend: 5 months back + selected month
  const trendStart = new Date(Date.UTC(year, month - 6, 1));

  const [tagPersonAgg, trendAgg, allTags, rawExpenses] = await Promise.all([
    Expense.aggregate<{
      _id: { tagPath: string; tagSortOrder: number; paidBy: string };
      total: number;
      count: number;
    }>(tagPersonPipeline({ start, end }, { includeCount: true })),

    Expense.aggregate<{
      _id: { year: number; month: number; settlementType: string };
      total: number;
    }>(trendPipeline({ start: trendStart, end })),

    Tag.find().sort({ sortOrder: 1 }).lean(),

    Expense.find({ date: { $gte: start, $lt: end } })
      .sort({ date: 1, createdAt: 1 })
      .populate("tags")
      .lean(),
  ]);

  const tagTotals = buildTagTotals(tagPersonAgg, allTags, persons[0].key);
  const tagsWithSpending = tagTotals.filter((t) => t.total > 0);

  const expensesByTagObj = groupExpensesByTag(
    rawExpenses as unknown as Parameters<typeof groupExpensesByTag>[0]
  );

  const monthlyTotals = buildTrendSeries(
    trendAgg,
    generateMonthEntries(year, month - 5, 6)
  );

  const { deferredTotal, immediateTotal, person1Total, person2Total, totalSpending } =
    computePersonSummary(
      rawExpenses as unknown as Parameters<typeof computePersonSummary>[0],
      persons[0].key
    );
  const hasExpenses = totalSpending > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-sm text-muted-foreground">
              Spending breakdown and trends.
            </p>
            <Link
              href={`/reports/annual?year=${year}`}
              className="text-sm text-primary/70 hover:text-primary transition-colors"
            >
              Year in Review &rarr;
            </Link>
          </div>
        </div>
        <MonthNav month={month} year={year} basePath="/reports" />
      </div>

      {!hasExpenses ? (
        <div className="rounded-xl border border-dashed border-primary/20 bg-card py-12 text-center">
          <LiveRegion visible className="text-sm text-muted-foreground">
            No expenses for {formatMonthYear(month, year)}.
          </LiveRegion>
        </div>
      ) : (
        <>
          {/* Summary card */}
          <SpendingSummaryCard
            label={formatMonthYear(month, year)}
            totalSpending={totalSpending}
            deferredTotal={deferredTotal}
            immediateTotal={immediateTotal}
            person1Total={person1Total}
            person2Total={person2Total}
            persons={persons}
          />

          {/* Tag breakdown with bars */}
          <TagBreakdown
            tags={tagsWithSpending.map((t) => ({
              tagName: t.tagPath,
              total: t.total,
            }))}
          />

          {/* Person x Tag matrix */}
          <PersonTagMatrix
            tags={tagsWithSpending}
            expensesByTag={expensesByTagObj}
          />
        </>
      )}

      {/* Monthly trend (always shown -- even if current month is empty) */}
      <MonthlyTrend
        months={monthlyTotals}
        selectedMonth={month}
        selectedYear={year}
      />
    </div>
  );
}
