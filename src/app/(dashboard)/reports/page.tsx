import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Category } from "@/lib/models/category";
import { getPersons } from "@/lib/persons";
import { MonthNav } from "@/components/month-nav";
import { SpendingSummaryCard } from "./_components/spending-summary-card";
import { CategoryBreakdown } from "./_components/category-breakdown";
import { PersonCategoryMatrix } from "./_components/person-category-matrix";
import { MonthlyTrend } from "./_components/monthly-trend";

export const dynamic = "force-dynamic";

interface CategoryTotal {
  categoryName: string;
  settlementType: "immediate" | "deferred";
  person1Paid: number;
  person2Paid: number;
  total: number;
}

export interface ExpenseDetail {
  date: string;
  where: string;
  paidBy: string;
  amount: number;
  splitType: "split" | "full";
  notes?: string;
  categoryName: string;
}

interface MonthlyTotal {
  month: number;
  year: number;
  deferredTotal: number;
  immediateTotal: number;
  total: number;
}

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const month = parseInt(params.month ?? "") || now.getMonth() + 1;
  const year = parseInt(params.year ?? "") || now.getFullYear();

  await connectToDatabase();

  const persons = (await getPersons())!;

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  // 6-month trend: 5 months back + selected month
  const trendStart = new Date(Date.UTC(year, month - 6, 1));

  const [categoryPersonAgg, trendAgg, allCategories, rawExpenses] = await Promise.all([
    // Query 1: Category × Person breakdown for selected month
    Expense.aggregate<{
      _id: {
        categoryId: string;
        categoryName: string;
        settlementType: "immediate" | "deferred";
        sortOrder: number;
        paidBy: string;
      };
      total: number;
      count: number;
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
            categoryId: "$cat._id",
            categoryName: "$cat.name",
            settlementType: "$cat.settlementType",
            sortOrder: "$cat.sortOrder",
            paidBy: "$paidBy",
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.sortOrder": 1, "_id.paidBy": 1 } },
    ]),

    // Query 2: Monthly trend (last 6 months)
    Expense.aggregate<{
      _id: {
        year: number;
        month: number;
        settlementType: "immediate" | "deferred";
      };
      total: number;
    }>([
      { $match: { date: { $gte: trendStart, $lt: end } } },
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

    // Query 3: All categories for zero-fill
    Category.find().sort({ sortOrder: 1 }).lean(),

    // Query 4: Raw expenses for drill-down
    Expense.find({ date: { $gte: start, $lt: end } })
      .sort({ date: 1, createdAt: 1 })
      .populate("category")
      .lean(),
  ]);

  // ── Shape category totals ──────────────────────────────────────────────
  const categoryMap = new Map<
    string,
    CategoryTotal
  >();

  // Seed with all categories (so categories with 0 expenses still appear)
  for (const cat of allCategories) {
    categoryMap.set(cat.name, {
      categoryName: cat.name,
      settlementType: cat.settlementType,
      person1Paid: 0,
      person2Paid: 0,
      total: 0,
    });
  }

  // Fill from aggregation
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

  // Filter out categories with no spending for the breakdown view
  const categoriesWithSpending = categories.filter((c) => c.total > 0);

  // ── Group expenses by category for drill-down ──────────────────────────
  const expensesByCategory = new Map<string, ExpenseDetail[]>();
  for (const e of rawExpenses) {
    if (!e.category) continue;
    const cat = e.category as unknown as {
      _id: mongoose.Types.ObjectId;
      name: string;
    };
    const catName = cat.name;
    if (!expensesByCategory.has(catName)) {
      expensesByCategory.set(catName, []);
    }
    expensesByCategory.get(catName)!.push({
      date: (e.date as Date).toISOString(),
      where: e.where,
      paidBy: e.paidBy as string,
      amount: e.amount,
      splitType: e.splitType,
      notes: e.notes,
      categoryName: catName,
    });
  }

  const expensesByCategoryObj: Record<string, ExpenseDetail[]> = {};
  for (const [key, val] of expensesByCategory) {
    expensesByCategoryObj[key] = val;
  }

  // ── Shape monthly trend ────────────────────────────────────────────────
  const trendMap = new Map<string, MonthlyTotal>();

  // Generate all 6 months
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(year, month - 6 + i, 1));
    const m = d.getUTCMonth() + 1;
    const y = d.getUTCFullYear();
    trendMap.set(`${y}-${m}`, {
      month: m,
      year: y,
      deferredTotal: 0,
      immediateTotal: 0,
      total: 0,
    });
  }

  // Fill from aggregation
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

  // ── Compute summary totals ─────────────────────────────────────────────
  const deferredTotal = categories
    .filter((c) => c.settlementType === "deferred")
    .reduce((s, c) => s + c.total, 0);
  const immediateTotal = categories
    .filter((c) => c.settlementType === "immediate")
    .reduce((s, c) => s + c.total, 0);
  const totalSpending = deferredTotal + immediateTotal;
  const person1Total = categories.reduce((s, c) => s + c.person1Paid, 0);
  const person2Total = categories.reduce((s, c) => s + c.person2Paid, 0);

  const hasExpenses = totalSpending > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Spending breakdown and trends.
          </p>
        </div>
        <MonthNav month={month} year={year} basePath="/reports" />
      </div>

      {!hasExpenses ? (
        <div className="rounded-xl border border-dashed border-primary/20 bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No expenses for {monthLabel(month, year)}.
          </p>
        </div>
      ) : (
        <>
          {/* Summary card */}
          <SpendingSummaryCard
            label={monthLabel(month, year)}
            totalSpending={totalSpending}
            deferredTotal={deferredTotal}
            immediateTotal={immediateTotal}
            person1Total={person1Total}
            person2Total={person2Total}
            persons={persons}
          />

          {/* Category breakdown with bars */}
          <CategoryBreakdown
            categories={categoriesWithSpending.map((c) => ({
              categoryName: c.categoryName,
              settlementType: c.settlementType,
              total: c.total,
            }))}
          />

          {/* Person × Category matrix */}
          <PersonCategoryMatrix
            categories={categoriesWithSpending}
            expensesByCategory={expensesByCategoryObj}
          />
        </>
      )}

      {/* Monthly trend (always shown — even if current month is empty) */}
      <MonthlyTrend
        months={monthlyTotals}
        selectedMonth={month}
        selectedYear={year}
      />
    </div>
  );
}
