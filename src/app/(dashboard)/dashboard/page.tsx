import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Category } from "@/lib/models/category";
import { Settlement } from "@/lib/models/settlement";
import { getPersons } from "@/lib/persons";
import {
  calculateSettlement,
  type SettlementExpenseRow,
} from "@/lib/settlement-calc";
import { SpendingSummaryCard } from "../reports/_components/spending-summary-card";
import { SettlementStatusCard } from "./_components/settlement-status-card";
import { RecentExpenses } from "./_components/recent-expenses";
import { QuickActions } from "./_components/quick-actions";

export const dynamic = "force-dynamic";

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  await connectToDatabase();

  const persons = (await getPersons())!;

  const [
    categoryPersonAgg,
    settlementRecord,
    recentRaw,
    expenseMonths,
    closedSettlements,
    currentMonthExpensesRaw,
  ] = await Promise.all([
    // 1. Current month spending by category × person
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
    ]),

    // 2. Settlement record for current month
    Settlement.findOne({ month, year }).lean(),

    // 3. Recent 10 expenses (any month)
    Expense.find()
      .sort({ date: -1, createdAt: -1 })
      .limit(10)
      .populate("category")
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
      .populate("category")
      .lean(),
  ]);

  // ── Spending summary totals ───────────────────────────────────────────
  const allCategories = await Category.find().sort({ sortOrder: 1 }).lean();

  const categoryMap = new Map<
    string,
    {
      settlementType: "immediate" | "deferred";
      person1Paid: number;
      person2Paid: number;
      total: number;
    }
  >();

  for (const cat of allCategories) {
    categoryMap.set(cat.name, {
      settlementType: cat.settlementType,
      person1Paid: 0,
      person2Paid: 0,
      total: 0,
    });
  }

  for (const row of categoryPersonAgg) {
    let entry = categoryMap.get(row._id.categoryName);
    if (!entry) {
      entry = {
        settlementType: row._id.settlementType,
        person1Paid: 0,
        person2Paid: 0,
        total: 0,
      };
      categoryMap.set(row._id.categoryName, entry);
    }
    if (row._id.paidBy === persons[0].key) {
      entry.person1Paid += row.total;
    } else {
      entry.person2Paid += row.total;
    }
    entry.total += row.total;
  }

  const categories = [...categoryMap.values()];
  const deferredTotal = categories
    .filter((c) => c.settlementType === "deferred")
    .reduce((s, c) => s + c.total, 0);
  const immediateTotal = categories
    .filter((c) => c.settlementType === "immediate")
    .reduce((s, c) => s + c.total, 0);
  const totalSpending = deferredTotal + immediateTotal;
  const person1Total = categories.reduce((s, c) => s + c.person1Paid, 0);
  const person2Total = categories.reduce((s, c) => s + c.person2Paid, 0);

  // ── Settlement status ─────────────────────────────────────────────────
  const isClosed =
    !!settlementRecord && settlementRecord.status !== "open";

  const expenses: SettlementExpenseRow[] = (
    currentMonthExpensesRaw as unknown as Record<string, unknown>[]
  )
    .filter((e) => e.category != null)
    .map((e) => {
      const cat = e.category as Record<string, unknown>;
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
  )
    .filter((e) => e.category != null)
    .map((e) => {
      const cat = e.category as Record<string, unknown>;
      return {
        date: (e.date as Date).toISOString(),
        where: e.where as string,
        categoryName: cat.name as string,
        paidBy: e.paidBy as string,
        amount: e.amount as number,
      };
    });

  const hasExpenses = totalSpending > 0;
  const label = monthLabel(month, year);

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

        {/* Right column — settlement + quick actions */}
        <div className="space-y-6">
          <SettlementStatusCard
            monthLabel={label}
            isClosed={isClosed}
            netOwedBy={netOwedBy}
            netAmount={netAmount}
            unsettledMonthCount={unsettledMonthCount}
          />

          <QuickActions />
        </div>
      </div>
    </div>
  );
}
