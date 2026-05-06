import mongoose from "mongoose";
import Link from "next/link";
import { Upload } from "lucide-react";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Category } from "@/lib/models/category";
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { seedCategoriesIfEmpty } from "@/lib/category-seed";
import type { SerializedCategory } from "@/lib/models/category";
import type { SerializedExpense } from "@/lib/models/expense";
import { ExpenseForm } from "./_components/expense-form";
import { ExpenseList } from "./_components/expense-list";
import { ExpenseFilters } from "./_components/expense-filters";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    paidBy?: string;
    month?: string;
    year?: string;
  }>;
}

export default async function ExpensesPage({ searchParams }: PageProps) {
  const session = await auth();
  const paidBy = session?.user?.paidByKey ?? "";
  const isAdmin = session?.user?.role === "admin";

  const params = await searchParams;
  const now = new Date();

  // Parse filter params — default to current month
  const month = params.month === "all" ? null : (params.month ? parseInt(params.month) : now.getMonth() + 1);
  const year = params.year ? parseInt(params.year) : now.getFullYear();
  const q = params.q?.trim() || "";
  const categoryFilter = params.category || "";
  const paidByFilter = params.paidBy || "";

  await connectToDatabase();
  await seedCategoriesIfEmpty();

  const [rawCategories, closedSettlements] = await Promise.all([
    Category.find().sort({ sortOrder: 1 }).lean(),
    Settlement.find({ status: "closed" }, { month: 1, year: 1, _id: 0 }).lean(),
  ]);

  // Build dynamic query
  const query: Record<string, unknown> = {};

  if (month !== null) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    query.date = { $gte: start, $lt: end };
  }

  if (q) {
    query.where = { $regex: q, $options: "i" };
  }

  if (paidByFilter) {
    query.paidBy = paidByFilter;
  }

  if (categoryFilter) {
    const cat = rawCategories.find(
      (c) => c.name.toLowerCase() === categoryFilter.toLowerCase()
    );
    if (cat) {
      query.category = cat._id;
    }
  }

  const rawExpenses = await Expense.find(query)
    .sort({ date: -1, createdAt: -1 })
    .limit(month === null ? 200 : 0)
    .populate("category")
    .lean();

  const closedMonths = new Set(
    closedSettlements.map((s) => `${s.year}-${s.month}`)
  );

  const categories: SerializedCategory[] = rawCategories.map((c) => ({
    _id: c._id.toString(),
    name: c.name,
    settlementType: c.settlementType,
    sortOrder: c.sortOrder,
  }));

  const expenses: SerializedExpense[] = rawExpenses
    .filter((e) => e.category != null)
    .map((e) => {
      const cat = e.category as unknown as {
        _id: mongoose.Types.ObjectId;
        name: string;
        settlementType: string;
        sortOrder: number;
      };
      return {
        _id: e._id.toString(),
        paidBy: e.paidBy,
        date: (e.date as Date).toISOString(),
        category: {
          _id: cat._id.toString(),
          name: cat.name,
          settlementType: cat.settlementType as "immediate" | "deferred",
          sortOrder: cat.sortOrder,
        },
        amount: e.amount,
        where: e.where,
        notes: e.notes,
        splitType: e.splitType,
        createdAt: (e.createdAt as Date).toISOString(),
        updatedAt: (e.updatedAt as Date).toISOString(),
      };
    });

  const isFiltered = !!(q || categoryFilter || paidByFilter);

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Log and review shared expenses.
          </p>
        </div>
        <Link
          href="/expenses/import"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 h-7 text-[0.8rem] font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Upload className="h-3.5 w-3.5" />
          Import CSV
        </Link>
      </div>

      <div className="border rounded-xl p-6 bg-card shadow-sm">
        <ExpenseForm
          categories={categories}
          paidBy={paidBy}
          closedMonths={[...closedMonths]}
        />
      </div>

      <ExpenseFilters
        categories={categories}
        filters={{
          q,
          category: categoryFilter,
          paidBy: paidByFilter,
          month,
          year,
        }}
      />

      <ExpenseList
        expenses={expenses}
        closedMonths={closedMonths}
        isFiltered={isFiltered}
        isAdmin={isAdmin}
        categories={categories}
        closedMonthsList={[...closedMonths]}
      />
    </div>
  );
}
