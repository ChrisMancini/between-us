import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { Settlement } from "@/lib/models/settlement";
import { getPersons } from "@/lib/persons";
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
import type {
  BiggestExpense,
  TopMerchant,
  BusiestMonth,
} from "./_components/annual-highlights";

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
    // 1. Tag × Person breakdown for the year (unwound by tag)
    Expense.aggregate<{
      _id: {
        tagPath: string;
        tagSortOrder: number;
        paidBy: string;
      };
      total: number;
    }>([
      { $match: { date: { $gte: start, $lt: end } } },
      {
        $lookup: {
          from: "tags",
          localField: "tags",
          foreignField: "_id",
          as: "tagDocs",
        },
      },
      { $unwind: "$tagDocs" },
      {
        $group: {
          _id: {
            tagPath: "$tagDocs.path",
            tagSortOrder: "$tagDocs.sortOrder",
            paidBy: "$paidBy",
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.tagSortOrder": 1, "_id.paidBy": 1 } },
    ]),

    // 2. Monthly trend (all 12 months) - uses expense settlementType
    Expense.aggregate<{
      _id: {
        year: number;
        month: number;
        settlementType: "immediate" | "deferred";
      };
      total: number;
    }>([
      { $match: { date: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            settlementType: "$settlementType",
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    // 3. All tags for zero-fill
    Tag.find().sort({ sortOrder: 1 }).lean(),

    // 4. Biggest single expense
    Expense.findOne({ date: { $gte: start, $lt: end } })
      .sort({ amount: -1 })
      .populate("tags")
      .lean(),

    // 5. Most frequent merchant
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

    // 6. Closed settlements for this year
    Settlement.find({ year, status: "closed" }).sort({ month: 1 }).lean(),
  ]);

  // ── Shape tag totals (from unwound aggregation) ──────────────────────
  const tagMap = new Map<
    string,
    {
      tagName: string;
      total: number;
    }
  >();

  for (const tag of allTags) {
    tagMap.set(tag.path, {
      tagName: tag.path,
      total: 0,
    });
  }

  for (const row of tagPersonAgg) {
    const key = row._id.tagPath;
    let entry = tagMap.get(key);
    if (!entry) {
      entry = {
        tagName: key,
        total: 0,
      };
      tagMap.set(key, entry);
    }
    entry.total += row.total;
  }

  const tagTotals = [...tagMap.values()].sort((a, b) => {
    const ai = allTags.findIndex((t) => t.path === a.tagName);
    const bi = allTags.findIndex((t) => t.path === b.tagName);
    return ai - bi;
  });

  const tagsWithSpending = tagTotals.filter((t) => t.total > 0);

  // ── Summary totals from raw aggregation (per settlement type, not per tag) ──
  // We need a separate aggregation to get accurate totals by person and settlement type
  // without double-counting from multi-tag expenses. Use the tagPersonAgg paidBy data
  // but compute deferred/immediate from the trend aggregation for this year.
  let deferredTotal = 0;
  let immediateTotal = 0;
  let person1Total = 0;
  let person2Total = 0;

  // Person totals from tag aggregation may double-count multi-tag expenses.
  // Use a separate simple aggregation instead.
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

  for (const row of personSummaryAgg) {
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

  // ── Shape monthly trend (all 12 months) ────────────────────────────────
  const trendMap = new Map<
    string,
    {
      month: number;
      year: number;
      deferredTotal: number;
      immediateTotal: number;
      total: number;
    }
  >();

  for (let m = 1; m <= 12; m++) {
    trendMap.set(`${year}-${m}`, {
      month: m,
      year,
      deferredTotal: 0,
      immediateTotal: 0,
      total: 0,
    });
  }

  for (const row of trendAgg) {
    const key = `${row._id.year}-${row._id.month}`;
    const entry = trendMap.get(key);
    if (!entry) continue;
    if (row._id.settlementType === "deferred") {
      entry.deferredTotal += row.total;
    } else {
      entry.immediateTotal += row.total;
    }
    entry.total += row.total;
  }

  const monthlyTotals = [...trendMap.values()];

  // ── Biggest expense ────────────────────────────────────────────────────
  let biggestExpense: BiggestExpense | null = null;
  if (biggestExpenseResult) {
    const expTags = (biggestExpenseResult.tags ?? []) as unknown as { path: string }[];
    const tagNames = expTags.map((t) => t.path).join(", ");
    biggestExpense = {
      amount: biggestExpenseResult.amount,
      where: biggestExpenseResult.where,
      date: (biggestExpenseResult.date as Date).toISOString(),
      tagNames: tagNames || "Untagged",
      paidBy: biggestExpenseResult.paidBy as string,
    };
  }

  // ── Top merchant ───────────────────────────────────────────────────────
  let topMerchant: TopMerchant | null = null;
  if (topMerchantAgg.length > 0) {
    topMerchant = {
      where: topMerchantAgg[0]._id,
      count: topMerchantAgg[0].count,
      total: topMerchantAgg[0].total,
    };
  }

  // ── Busiest month ─────────────────────────────────────────────────────
  let busiestMonth: BusiestMonth | null = null;
  for (const m of monthlyTotals) {
    if (m.total > 0 && (!busiestMonth || m.total > busiestMonth.total)) {
      busiestMonth = { month: m.month, year: m.year, total: m.total };
    }
  }

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
      <div className="flex items-center justify-between">
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
