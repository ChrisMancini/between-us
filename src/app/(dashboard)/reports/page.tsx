import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { getPersons } from "@/lib/persons";
import { MonthNav } from "@/components/month-nav";
import { SpendingSummaryCard } from "./_components/spending-summary-card";
import { TagBreakdown } from "./_components/tag-breakdown";
import { PersonTagMatrix } from "./_components/person-tag-matrix";
import { MonthlyTrend } from "./_components/monthly-trend";

export const dynamic = "force-dynamic";

interface TagTotal {
  tagPath: string;
  tagName: string;
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
  tagName: string;
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

  const [tagPersonAgg, trendAgg, allTags, rawExpenses] = await Promise.all([
    // Query 1: Tag × Person breakdown for selected month (unwound by tag)
    Expense.aggregate<{
      _id: {
        tagPath: string;
        tagSortOrder: number;
        paidBy: string;
      };
      total: number;
      count: number;
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
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.tagSortOrder": 1, "_id.paidBy": 1 } },
    ]),

    // Query 2: Monthly trend (last 6 months) - uses expense settlementType directly
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

    // Query 3: All tags for zero-fill
    Tag.find().sort({ sortOrder: 1 }).lean(),

    // Query 4: Raw expenses for drill-down and summary totals
    Expense.find({ date: { $gte: start, $lt: end } })
      .sort({ date: 1, createdAt: 1 })
      .populate("tags")
      .lean(),
  ]);

  // ── Shape tag totals (from unwound aggregation — for per-tag breakdown) ──
  const tagMap = new Map<string, TagTotal>();

  // Seed with all tags (so tags with 0 expenses still appear)
  for (const tag of allTags) {
    const segments = tag.path.split("/");
    tagMap.set(tag.path, {
      tagPath: tag.path,
      tagName: segments[segments.length - 1],
      settlementType: "deferred", // tags don't have settlementType; will be overridden from expenses
      person1Paid: 0,
      person2Paid: 0,
      total: 0,
    });
  }

  // Fill from aggregation
  for (const row of tagPersonAgg) {
    const key = row._id.tagPath;
    let entry = tagMap.get(key);
    if (!entry) {
      const segments = key.split("/");
      entry = {
        tagPath: key,
        tagName: segments[segments.length - 1],
        settlementType: "deferred",
        person1Paid: 0,
        person2Paid: 0,
        total: 0,
      };
      tagMap.set(key, entry);
    }
    if (row._id.paidBy === persons[0].key) {
      entry.person1Paid += row.total;
    } else {
      entry.person2Paid += row.total;
    }
    entry.total += row.total;
  }

  const tagTotals = [...tagMap.values()].sort((a, b) => {
    const ai = allTags.findIndex((t) => t.path === a.tagPath);
    const bi = allTags.findIndex((t) => t.path === b.tagPath);
    return ai - bi;
  });

  // Filter out tags with no spending for the breakdown view
  const tagsWithSpending = tagTotals.filter((t) => t.total > 0);

  // ── Group expenses by tag for drill-down ──────────────────────────────
  const expensesByTag = new Map<string, ExpenseDetail[]>();
  for (const e of rawExpenses) {
    const eTags = (e.tags ?? []) as unknown as { path: string }[];
    for (const tag of eTags) {
      const tagPath = tag.path;
      if (!expensesByTag.has(tagPath)) {
        expensesByTag.set(tagPath, []);
      }
      expensesByTag.get(tagPath)!.push({
        date: (e.date as Date).toISOString(),
        where: e.where,
        paidBy: e.paidBy as string,
        amount: e.amount,
        splitType: e.splitType,
        notes: e.notes,
        tagName: tagPath,
      });
    }
  }

  const expensesByTagObj: Record<string, ExpenseDetail[]> = {};
  for (const [key, val] of expensesByTag) {
    expensesByTagObj[key] = val;
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

  // ── Compute summary totals from raw expenses (not unwound) to avoid double-counting ──
  let deferredTotal = 0;
  let immediateTotal = 0;
  let person1Total = 0;
  let person2Total = 0;

  for (const e of rawExpenses) {
    const amount = e.amount as number;
    const settlementType = e.settlementType as "immediate" | "deferred";
    const paidBy = e.paidBy as string;

    if (settlementType === "deferred") {
      deferredTotal += amount;
    } else {
      immediateTotal += amount;
    }
    if (paidBy === persons[0].key) {
      person1Total += amount;
    } else {
      person2Total += amount;
    }
  }

  const totalSpending = deferredTotal + immediateTotal;
  const hasExpenses = totalSpending > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
