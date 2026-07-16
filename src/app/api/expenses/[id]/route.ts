import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Expense, type IExpense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { expenseUpdateApiSchema } from "@/lib/validations/expense";
import { serializeTag } from "@/lib/tag-utils";
import { collapseToMostSpecific } from "@/lib/tag-hierarchy";
import { withAuth, canModifyExpense } from "@/lib/auth-guard";
import { validationError, invalidId } from "@/lib/api-utils";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { Settlement } from "@/lib/models/settlement";
import { logActivity } from "@/lib/activity-logger";
import { resetReadinessForMonths } from "@/lib/readiness-reset";
import { formatCurrency, formatMonthYear } from "@/lib/utils";
import { handleExpenseChange, handleExpenseDelete, getOtherPersonKey } from "@/lib/action-lifecycle";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const HEAD = withAuth<RouteContext>(async (_req, session, context) => {
  const { id } = await context.params;
  const idErr = invalidId(id);
  if (idErr) return idErr;

  await connectToDatabase();

  const expense = await Expense.findById(id).lean();
  if (!expense) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(null, { status: 200 });
});

function detectChanges(
  existing: IExpense,
  updated: { date: string; tagIds: string[]; amount: number; where: string; notes?: string; splitType: string; settlementType: string },
): string[] {
  const changes: string[] = [];
  if (existing.amount !== updated.amount) changes.push("amount");
  if (existing.where !== updated.where) changes.push("where");
  const oldTagIds = existing.tags.map((t: mongoose.Types.ObjectId) => t.toString()).sort().join(",");
  const newTagIds = [...updated.tagIds].sort().join(",");
  if (oldTagIds !== newTagIds) changes.push("tags");
  if (existing.date.toISOString() !== new Date(updated.date).toISOString()) changes.push("date");
  if (existing.splitType !== updated.splitType) changes.push("split type");
  if (existing.settlementType !== updated.settlementType) changes.push("settlement type");
  if ((existing.notes ?? "") !== (updated.notes ?? "")) changes.push("notes");
  return changes;
}

export const GET = withAuth<RouteContext>(async (_req, session, context) => {
  const { id } = await context.params;
  const idErr = invalidId(id);
  if (idErr) return idErr;

  await connectToDatabase();

  const expense = await Expense.findById(id).populate("tags").lean();
  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const tags = (expense.tags ?? []) as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    path: string;
    sortOrder: number;
  }>;

  return NextResponse.json({
    expense: {
      _id: expense._id.toString(),
      paidBy: expense.paidBy,
      date: (expense.date as Date).toISOString(),
      tags: tags.map(serializeTag),
      amount: expense.amount,
      where: expense.where,
      notes: expense.notes,
      splitType: expense.splitType,
      settlementType: expense.settlementType,
      createdAt: (expense.createdAt as Date).toISOString(),
      updatedAt: (expense.updatedAt as Date).toISOString(),
    },
  });
});

export const PUT = withAuth<RouteContext>(async (req, session, context) => {
  const { id } = await context.params;
  const idErr = invalidId(id);
  if (idErr) return idErr;

  const body = await req.json();
  const parsed = expenseUpdateApiSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  const { date, tagIds, amount, where, notes, splitType, settlementType } = parsed.data;

  for (const tagId of tagIds) {
    if (!mongoose.isValidObjectId(tagId)) {
      return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
    }
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

  const existingTags = await Tag.find({ _id: { $in: tagIds } }).lean();
  if (existingTags.length !== tagIds.length) {
    return NextResponse.json({ error: "One or more tags not found" }, { status: 422 });
  }

  const pathById = new Map(existingTags.map((t) => [String(t._id), t.path as string]));
  const normalizedTagIds = collapseToMostSpecific(tagIds, pathById);

  const updated = await Expense.findByIdAndUpdate(
    id,
    { date: new Date(date), tags: normalizedTagIds, amount, where, notes, splitType, settlementType },
    { returnDocument: "after" },
  ).populate("tags");

  if (!updated) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const tags = updated.tags as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    path: string;
    sortOrder: number;
  }>;

  await resetReadinessForMonths(session.user.paidByKey, [existing.date, date]);

  const changes = detectChanges(existing, { date, tagIds: normalizedTagIds, amount, where, notes, splitType, settlementType });
  const changedLabel = changes.length > 0 ? ` (${changes.join(", ")})` : "";
  const tagNames = tags.map((t) => t.path).join(", ");

  await logActivity(session.user.paidByKey, "expense_edit", `edited ${formatCurrency(amount)} at ${where}${changedLabel}`, {
    expenseId: id,
    amount,
    where,
    tagNames,
    paidBy: updated.paidBy,
    changedFields: changes,
  });

  const otherPersonKey = await getOtherPersonKey(existing.paidBy);
  await handleExpenseChange(
    existing,
    { amount, splitType, settlementType, where },
    otherPersonKey,
    session.user.paidByKey
  );

  return NextResponse.json({
    expense: {
      _id: updated._id.toString(),
      paidBy: updated.paidBy,
      date: updated.date.toISOString(),
      tags: tags.map(serializeTag),
      amount: updated.amount,
      where: updated.where,
      notes: updated.notes,
      splitType: updated.splitType,
      settlementType: updated.settlementType,
    },
  });
});

export const DELETE = withAuth<RouteContext>(async (_req, session, context) => {
  const { id } = await context.params;
  const idErr = invalidId(id);
  if (idErr) return idErr;

  await connectToDatabase();

  const existing = await Expense.findById(id).populate("tags").lean();
  if (!existing) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  if (!canModifyExpense(session, existing.paidBy as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const expDate = existing.date as Date;
  const month = expDate.getUTCMonth() + 1;
  const year = expDate.getUTCFullYear();
  const closed = await Settlement.findOne({ month, year, status: { $ne: "open" } }).lean();
  if (closed) {
    const label = formatMonthYear(month, year);
    return NextResponse.json(
      { error: `${label} has already been settled. Reopen the month first.` },
      { status: 422 },
    );
  }

  const tags = (existing.tags ?? []) as unknown as Array<{ path: string }>;
  const tagNames = tags.map((t) => t.path).join(", ");

  await Expense.findByIdAndDelete(id);

  await handleExpenseDelete(existing as unknown as IExpense, session.user.paidByKey);

  await resetReadinessForMonths(session.user.paidByKey, [existing.date]);

  await logActivity(session.user.paidByKey, "expense_delete", `deleted ${formatCurrency(existing.amount as number)} at ${existing.where}`, {
    amount: existing.amount,
    where: existing.where,
    tagNames,
    paidBy: existing.paidBy,
  });

  return NextResponse.json({ success: true });
});
