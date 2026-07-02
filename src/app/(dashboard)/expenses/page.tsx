import { auth } from "@/auth";
import Link from "next/link";
import { Upload } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Tag } from "@/lib/models/tag";
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { serializeTag } from "@/lib/tag-utils";
import { getMonthDateRange } from "@/lib/utils";
import type { SerializedTag } from "@/lib/models/tag";
import type { SerializedExpense } from "@/lib/models/expense";
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
  const now = new Date();

  const month = params.month === "all" ? null : (params.month ? parseInt(params.month) : now.getMonth() + 1);
  const year = params.year ? parseInt(params.year) : now.getFullYear();
  const q = params.q?.trim() || "";
  const tagFilter = params.tag || "";
  const paidByFilter = params.paidBy || "";

  await connectToDatabase();

  const [rawTags, closedSettlements] = await Promise.all([
    Tag.find().sort({ sortOrder: 1 }).lean(),
    Settlement.find({ status: "closed" }, { month: 1, year: 1, _id: 0 }).lean(),
  ]);

  const query: Record<string, unknown> = {};

  if (month !== null) {
    const { start, end } = getMonthDateRange(month, year);
    query.date = { $gte: start, $lt: end };
  }

  if (q) {
    query.where = { $regex: q, $options: "i" };
  }

  if (paidByFilter) {
    query.paidBy = paidByFilter;
  }

  if (tagFilter) {
    // Match by exact tag path or any descendant (hierarchical filter)
    const matchingTag = rawTags.find(
      (t) => t.path.toLowerCase() === tagFilter.toLowerCase()
    );
    if (matchingTag) {
      // Find this tag and all descendants
      const matchingIds = rawTags
        .filter(
          (t) =>
            t._id.toString() === matchingTag._id.toString() ||
            t.path.toLowerCase().startsWith(matchingTag.path.toLowerCase() + "/")
        )
        .map((t) => t._id);
      query.tags = { $in: matchingIds };
    }
  }

  const rawExpenses = await Expense.find(query)
    .sort({ date: -1, createdAt: -1 })
    .limit(month === null ? 200 : 0)
    .populate("tags")
    .lean();

  const closedMonths = new Set(
    closedSettlements.map((s) => `${s.year}-${s.month}`)
  );

  const tags: SerializedTag[] = rawTags.map(serializeTag);

  const expenses: SerializedExpense[] = rawExpenses.map((e) => {
    const expTags = (e.tags ?? []) as unknown as Array<{
      _id: { toString(): string };
      path: string;
      sortOrder: number;
    }>;
    return {
      _id: e._id.toString(),
      paidBy: e.paidBy,
      date: (e.date as Date).toISOString(),
      tags: expTags.map(serializeTag),
      amount: e.amount,
      where: e.where,
      notes: e.notes,
      splitType: e.splitType,
      settlementType: e.settlementType,
      createdAt: (e.createdAt as Date).toISOString(),
      updatedAt: (e.updatedAt as Date).toISOString(),
    };
  });

  const prefill = (params.prefill_amount || params.prefill_where || params.prefill_date || params.prefill_tags)
    ? {
        amount: params.prefill_amount,
        where: params.prefill_where,
        date: params.prefill_date,
        tagIds: params.prefill_tags?.split(",").filter(Boolean),
      }
    : undefined;

  const isFiltered = !!(q || tagFilter || paidByFilter);

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
        expenses={expenses}
        closedMonths={closedMonths}
        isFiltered={isFiltered}
        currentUserKey={paidBy}
        isAdmin={session?.user?.role === "admin"}
        tags={tags}
        closedMonthsList={[...closedMonths]}
      />
    </div>
  );
}
