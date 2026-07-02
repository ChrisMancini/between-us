import { NextResponse } from "next/server";
import mongoose from "mongoose";
import type { Session } from "next-auth";
import { connectToDatabase } from "@/lib/db";
import { Expense, type IExpense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { bulkExpenseUpdateSchema, bulkExpenseDeleteSchema } from "@/lib/validations/bulk-expense";
import { withAuth, canModifyExpense } from "@/lib/auth-guard";
import { validationError } from "@/lib/api-utils";
import { logActivity } from "@/lib/activity-logger";
import { resetReadinessForMonths } from "@/lib/readiness-reset";
import { formatCurrency } from "@/lib/utils";
import { handleExpenseChange, handleExpenseDelete, getOtherPersonKey } from "@/lib/action-lifecycle";
import type { BulkEditResult, BulkDeleteResult } from "@/types/bulk-expense";
import { monthKey, validateExpenseIds, fetchExpensesAndClosedMonths } from "./helpers";

function computeTagUpdate(
  expense: IExpense,
  tags: { mode: "replace" | "add" | "remove"; tagIds: string[] },
): string[] | null {
  const existingTagIds = expense.tags.map((t: mongoose.Types.ObjectId) => t.toString());
  let newTagIds: string[];

  if (tags.mode === "replace") {
    newTagIds = tags.tagIds;
  } else if (tags.mode === "add") {
    const toAdd = tags.tagIds.filter((id) => !existingTagIds.includes(id));
    newTagIds = [...existingTagIds, ...toAdd];
  } else {
    const removeSet = new Set(tags.tagIds);
    newTagIds = existingTagIds.filter((id: string) => !removeSet.has(id));
  }

  if (newTagIds.length === 0) return null;

  const oldSorted = existingTagIds.sort().join(",");
  const newSorted = [...newTagIds].sort().join(",");
  return oldSorted !== newSorted ? newTagIds : null;
}

function buildUpdate(
  expense: IExpense,
  parsed: { tags?: { mode: "replace" | "add" | "remove"; tagIds: string[] }; splitType?: string; settlementType?: string },
  canEditSplitSettlement: boolean,
): { update: Record<string, unknown>; changes: string[] } {
  const update: Record<string, unknown> = {};
  const changes: string[] = [];

  if (parsed.tags) {
    const newTagIds = computeTagUpdate(expense, parsed.tags);
    if (newTagIds) {
      update.tags = newTagIds;
      changes.push("tags");
    }
  }

  if (parsed.splitType !== undefined && canEditSplitSettlement && expense.splitType !== parsed.splitType) {
    update.splitType = parsed.splitType;
    changes.push("split type");
  }

  if (parsed.settlementType !== undefined && canEditSplitSettlement && expense.settlementType !== parsed.settlementType) {
    update.settlementType = parsed.settlementType;
    changes.push("settlement type");
  }

  return { update, changes };
}

function skipReason(
  parsed: { splitType?: string; settlementType?: string },
  canEditSplitSettlement: boolean,
  isSettled: boolean,
): string {
  if ((parsed.splitType !== undefined || parsed.settlementType !== undefined) && !canEditSplitSettlement) {
    return isSettled ? "settled" : "not_owner";
  }
  return "no_changes";
}

async function applyAndLog(
  expense: IExpense,
  update: Record<string, unknown>,
  changes: string[],
  session: Session,
  readinessResetDates: Date[],
): Promise<BulkEditResult> {
  const updated = await Expense.findByIdAndUpdate(expense._id, update, {
    returnDocument: "after",
  }).populate("tags");

  if (!updated) {
    return { expenseId: expense._id.toString(), status: "skipped", reason: "no_changes" };
  }

  if (changes.includes("split type") || changes.includes("settlement type")) {
    readinessResetDates.push(expense.date);
  }

  if (changes.includes("settlement type") && update.settlementType) {
    const otherPersonKey = await getOtherPersonKey(expense.paidBy);
    const newSplitType = (update.splitType as "split" | "full" | undefined) ?? expense.splitType;
    await handleExpenseChange(
      expense,
      { settlementType: update.settlementType as "immediate" | "deferred", splitType: newSplitType },
      otherPersonKey,
      session.user.paidByKey,
    );
  }

  const updatedTags = updated.tags as unknown as Array<{ path: string }>;
  const tagNames = updatedTags.map((t) => t.path).join(", ");
  const changedLabel = ` (${changes.join(", ")}) (bulk edit)`;

  await logActivity(session.user.paidByKey, "expense_edit", `edited ${formatCurrency(updated.amount)} at ${updated.where}${changedLabel}`, {
    expenseId: expense._id.toString(),
    amount: updated.amount,
    where: updated.where,
    tagNames,
    paidBy: updated.paidBy,
    changedFields: changes,
    bulkEdit: true,
  });

  return { expenseId: expense._id.toString(), status: "updated", changedFields: changes };
}

// fallow-ignore-next-line complexity
export const PATCH = withAuth(async (req, session) => {
  const body = await req.json();
  const parsed = bulkExpenseUpdateSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed);

  const { expenseIds, tags, splitType, settlementType } = parsed.data;

  const idError = validateExpenseIds(expenseIds);
  if (idError) return idError;

  if (tags) {
    for (const tagId of tags.tagIds) {
      if (!mongoose.isValidObjectId(tagId)) {
        return NextResponse.json({ error: `Invalid tag ID: ${tagId}` }, { status: 400 });
      }
    }
  }

  await connectToDatabase();

  if (tags) {
    const foundTags = await Tag.find({ _id: { $in: tags.tagIds } }).lean();
    if (foundTags.length !== tags.tagIds.length) {
      return NextResponse.json({ error: "One or more tags not found" }, { status: 422 });
    }
  }

  const { expenses, closedMonths } = await fetchExpensesAndClosedMonths(expenseIds);

  const results: BulkEditResult[] = [];
  const readinessResetDates: Date[] = [];

  for (const expense of expenses) {
    const isSettled = closedMonths.has(monthKey(expense.date));
    const canEditSplitSettlement = !isSettled && canModifyExpense(session, expense.paidBy);

    const { update, changes } = buildUpdate(expense, { tags, splitType, settlementType }, canEditSplitSettlement);

    if (changes.length === 0) {
      results.push({
        expenseId: expense._id.toString(),
        status: "skipped",
        reason: skipReason({ splitType, settlementType }, canEditSplitSettlement, isSettled),
      });
      continue;
    }

    results.push(await applyAndLog(expense, update, changes, session, readinessResetDates));
  }

  if (readinessResetDates.length > 0) {
    await resetReadinessForMonths(session.user.paidByKey, readinessResetDates);
  }

  const updatedCount = results.filter((r) => r.status === "updated").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  return NextResponse.json({ results, summary: { updated: updatedCount, skipped: skippedCount } });
});

export const DELETE = withAuth(async (req, session) => {
  const body = await req.json();
  const parsed = bulkExpenseDeleteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed);

  const { expenseIds } = parsed.data;

  const idError = validateExpenseIds(expenseIds);
  if (idError) return idError;

  await connectToDatabase();

  const { expenses, closedMonths } = await fetchExpensesAndClosedMonths(expenseIds);

  const allTagIds = [...new Set(expenses.flatMap((e) => e.tags.map((t: mongoose.Types.ObjectId) => t.toString())))];
  const tagDocs = allTagIds.length > 0 ? await Tag.find({ _id: { $in: allTagIds } }).lean() : [];
  const tagMap = new Map(tagDocs.map((t) => [t._id.toString(), t.path as string]));

  const results: BulkDeleteResult[] = [];
  const readinessResetDates: Date[] = [];

  for (const expense of expenses) {
    const isSettled = closedMonths.has(monthKey(expense.date));

    if (isSettled) {
      results.push({ expenseId: expense._id.toString(), status: "skipped", reason: "settled" });
      continue;
    }

    if (!canModifyExpense(session, expense.paidBy)) {
      results.push({ expenseId: expense._id.toString(), status: "skipped", reason: "not_owner" });
      continue;
    }

    await Expense.findByIdAndDelete(expense._id);
    await handleExpenseDelete(expense, session.user.paidByKey);

    readinessResetDates.push(expense.date);

    const tagNames = expense.tags
      .map((t: mongoose.Types.ObjectId) => tagMap.get(t.toString()) ?? t.toString())
      .join(", ");

    await logActivity(
      session.user.paidByKey,
      "expense_delete",
      `deleted ${formatCurrency(expense.amount)} at ${expense.where} (bulk delete)`,
      { amount: expense.amount, where: expense.where, tagNames, paidBy: expense.paidBy, bulkDelete: true },
    );

    results.push({ expenseId: expense._id.toString(), status: "deleted" });
  }

  if (readinessResetDates.length > 0) {
    await resetReadinessForMonths(session.user.paidByKey, readinessResetDates);
  }

  const deletedCount = results.filter((r) => r.status === "deleted").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  return NextResponse.json({ results, summary: { deleted: deletedCount, skipped: skippedCount } });
});
