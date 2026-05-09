import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Category } from "@/lib/models/category";
import { expenseUpdateApiSchema } from "@/lib/validations/expense";
import { withAuth, canModifyExpense } from "@/lib/auth-guard";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { Settlement } from "@/lib/models/settlement";
import { logActivity } from "@/lib/activity-logger";
import { resetReadinessForMonths } from "@/lib/readiness-reset";
import { formatCurrency } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PUT = withAuth<RouteContext>(async (req, session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = expenseUpdateApiSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { date, categoryId, amount, where, notes, splitType } = parsed.data;

  if (!mongoose.isValidObjectId(categoryId)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await Expense.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  if (!canModifyExpense(session, existing.paidBy)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settlementError = await assertMonthsOpen([existing.date, date]);
  if (settlementError) return settlementError;

  const category = await Category.findById(categoryId);
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 422 });
  }

  const updated = await Expense.findByIdAndUpdate(
    id,
    { date: new Date(date), category: categoryId, amount, where, notes, splitType },
    { new: true }
  ).populate("category");

  if (!updated) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const cat = updated.category as unknown as {
    _id: mongoose.Types.ObjectId;
    name: string;
    settlementType: string;
    sortOrder: number;
  };

  await resetReadinessForMonths(session.user.paidByKey, [existing.date, date]);

  const changes: string[] = [];
  if (existing.amount !== amount) changes.push("amount");
  if (existing.where !== where) changes.push("where");
  if (existing.category.toString() !== categoryId) changes.push("category");
  if (existing.date.toISOString() !== new Date(date).toISOString()) changes.push("date");
  if (existing.splitType !== splitType) changes.push("split type");
  if ((existing.notes ?? "") !== (notes ?? "")) changes.push("notes");

  const changedLabel = changes.length > 0 ? ` (${changes.join(", ")})` : "";

  await logActivity(session.user.paidByKey, "expense_edit", `edited ${formatCurrency(amount)} at ${where}${changedLabel}`, {
    expenseId: id,
    amount,
    where,
    categoryName: cat.name,
    paidBy: updated.paidBy,
    changedFields: changes,
  });

  return NextResponse.json({
    expense: {
      _id: updated._id.toString(),
      paidBy: updated.paidBy,
      date: updated.date.toISOString(),
      category: {
        _id: cat._id.toString(),
        name: cat.name,
        settlementType: cat.settlementType,
        sortOrder: cat.sortOrder,
      },
      amount: updated.amount,
      where: updated.where,
      notes: updated.notes,
      splitType: updated.splitType,
    },
  });
});

export const DELETE = withAuth<RouteContext>(async (_req, session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await Expense.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  if (!canModifyExpense(session, existing.paidBy)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const month = existing.date.getUTCMonth() + 1;
  const year = existing.date.getUTCFullYear();
  const closed = await Settlement.findOne({ month, year, status: { $ne: "open" } }).lean();
  if (closed) {
    const label = new Date(year, month - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    return NextResponse.json(
      { error: `${label} has already been settled. Reopen the month first.` },
      { status: 422 }
    );
  }

  const category = await Category.findById(existing.category).lean();

  await Expense.findByIdAndDelete(id);

  await resetReadinessForMonths(session.user.paidByKey, [existing.date]);

  await logActivity(session.user.paidByKey, "expense_delete", `deleted ${formatCurrency(existing.amount)} at ${existing.where}`, {
    amount: existing.amount,
    where: existing.where,
    categoryName: category?.name ?? "Unknown",
    paidBy: existing.paidBy,
  });

  return NextResponse.json({ success: true });
});
