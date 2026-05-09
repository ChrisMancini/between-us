import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Category } from "@/lib/models/category";
import { Settlement } from "@/lib/models/settlement";
import { getPersons } from "@/lib/persons";
import { SpendingSummaryCard } from "../_components/spending-summary-card";
import { CategoryBreakdown } from "../_components/category-breakdown";
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
    categoryPersonAgg,
    trendAgg,
    allCategories,
    biggestExpenseResult,
    topMerchantAgg,
    closedSettlements,
  ] = await Promise.all([
    // 1. Category × Person breakdown for the year
    Expense.aggregate<{
      _id: {
        categoryName: string;
        settlementType: "immediate" | "deferred";
        sortOrder: number;
        paidBy: string;
      };
      total: number;
    }>([
      { $match: { date: { $gte: start, $lt: end } } },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "cat",
        },
      },
      { $unwind: "$cat" },
      {
        $group: {
          _id: {
            categoryName: "$cat.name",
            settlementType: "$cat.settlementType",
            sortOrder: "$cat.sortOrder",
            paidBy: "$paidBy",
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.sortOrder": 1, "_id.paidBy": 1 } },
    ]),

    // 2. Monthly trend (all 12 months)
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
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "cat",
        },
      },
      { $unwind: "$cat" },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            settlementType: "$cat.settlementType",
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    // 3. All categories for zero-fill
    Category.find().sort({ sortOrder: 1 }).lean(),

    // 4. Biggest single expense
    Expense.findOne({ date: { $gte: start, $lt: end } })
      .sort({ amount: -1 })
      .populate("category")
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

  // ── Shape category totals ──────────────────────────────────────────────
  const categoryMap = new Map<
    string,
    {
      categoryName: string;
      settlementType: "immediate" | "deferred";
      person1Paid: number;
      person2Paid: number;
      total: number;
    }
  >();

  for (const cat of allCategories) {
    categoryMap.set(cat.name, {
      categoryName: cat.name,
      settlementType: cat.settlementType,
      person1Paid: 0,
      person2Paid: 0,
      total: 0,
    });
  }

  for (const row of categoryPersonAgg) {
    const key = row._id.categoryName;
    let entry = categoryMap.get(key);
    if (!entry) {
      entry = {
        categoryName: key,
        settlementType: row._id.settlementType,
        person1Paid: 0,
        person2Paid: 0,
        total: 0,
      };
      categoryMap.set(key, entry);
    }
    if (row._id.paidBy === persons[0].key) {
      entry.person1Paid += row.total;
    } else {
      entry.person2Paid += row.total;
    }
    entry.total += row.total;
  }

  const categories = [...categoryMap.values()].sort((a, b) => {
    const ai = allCategories.findIndex((c) => c.name === a.categoryName);
    const bi = allCategories.findIndex((c) => c.name === b.categoryName);
    return ai - bi;
  });

  const categoriesWithSpending = categories.filter((c) => c.total > 0);

  // ── Summary totals ─────────────────────────────────────────────────────
  const deferredTotal = categories
    .filter((c) => c.settlementType === "deferred")
    .reduce((s, c) => s + c.total, 0);
  const immediateTotal = categories
    .filter((c) => c.settlementType === "immediate")
    .reduce((s, c) => s + c.total, 0);
  const totalSpending = deferredTotal + immediateTotal;
  const person1Total = categories.reduce((s, c) => s + c.person1Paid, 0);
  const person2Total = categories.reduce((s, c) => s + c.person2Paid, 0);

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
    const cat = biggestExpenseResult.category as unknown as {
      name: string;
    };
    biggestExpense = {
      amount: biggestExpenseResult.amount,
      where: biggestExpenseResult.where,
      date: (biggestExpenseResult.date as Date).toISOString(),
      categoryName: cat?.name ?? "Unknown",
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

          {/* Category breakdown */}
          <CategoryBreakdown
            categories={categoriesWithSpending.map((c) => ({
              categoryName: c.categoryName,
              settlementType: c.settlementType,
              total: c.total,
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
