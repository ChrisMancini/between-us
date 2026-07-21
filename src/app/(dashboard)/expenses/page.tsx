import { auth } from "@/auth";
import Link from "next/link";
import { Upload } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Tag } from "@/lib/models/tag";
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { serializeTag } from "@/lib/tag-utils";
import type { SerializedTag } from "@/lib/models/tag";
import { parseExpenseParams, buildExpenseQuery, serializeExpense, EXPENSE_PAGE_SIZE } from "./_lib/expense-queries";
import { ExpenseForm } from "./_components/expense-form";
import { ExpenseList } from "./_components/expense-list";
import { ExpenseFilters } from "./_components/expense-filters";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    tag?: string;
    paidBy?: string;
    month?: string;
    year?: string;
    prefill_amount?: string;
    prefill_where?: string;
    prefill_date?: string;
    prefill_tags?: string;
  }>;
}

export default async function ExpensesPage({ searchParams }: PageProps) {
  const session = await auth();
  const paidBy = session?.user?.paidByKey ?? "";

  const params = await searchParams;
  const { month, year, q, tagFilter, paidByFilter, prefill, isFiltered } = parseExpenseParams(params);

  await connectToDatabase();

  const [rawTags, closedSettlements] = await Promise.all([
    Tag.find().sort({ sortOrder: 1 }).lean(),
    Settlement.find({ status: "closed" }, { month: 1, year: 1, _id: 0 }).lean(),
  ]);

  const query = buildExpenseQuery(
    { month, year, q, tagFilter, paidByFilter },
    rawTags
  );

  const [rawExpenses, totalCount] = await Promise.all([
    Expense.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(EXPENSE_PAGE_SIZE)
      .populate("tags")
      .lean(),
    Expense.countDocuments(query),
  ]);

  const closedMonths = new Set(
    closedSettlements.map((s) => `${s.year}-${s.month}`)
  );

  const tags: SerializedTag[] = rawTags.map(serializeTag);

  const expenses = rawExpenses.map(serializeExpense);

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
          key={prefill ? JSON.stringify(prefill) : "default"}
          tags={tags}
          paidBy={paidBy}
          closedMonths={[...closedMonths]}
          prefill={prefill}
        />
      </div>

      <ExpenseFilters
        tags={tags}
        filters={{
          q,
          tag: tagFilter,
          paidBy: paidByFilter,
          month,
          year,
        }}
      />

      <ExpenseList
        key={`${month}-${year}-${q}-${tagFilter}-${paidByFilter}-${expenses[0]?._id ?? "empty"}`}
        expenses={expenses}
        totalCount={totalCount}
        closedMonths={closedMonths}
        isFiltered={isFiltered}
        currentUserKey={paidBy}
        isAdmin={session?.user?.role === "admin"}
        tags={tags}
        closedMonthsList={[...closedMonths]}
        filters={{ month, year, q, tag: tagFilter, paidBy: paidByFilter }}
      />
    </div>
  );
}
