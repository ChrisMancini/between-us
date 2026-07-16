import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { expenseApiSchema } from "@/lib/validations/expense";
import { serializeTag } from "@/lib/tag-utils";
import { collapseToMostSpecific } from "@/lib/tag-hierarchy";
import { withAuth } from "@/lib/auth-guard";
import { validationError } from "@/lib/api-utils";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { logActivity } from "@/lib/activity-logger";
import { resetReadinessForMonths } from "@/lib/readiness-reset";
import { formatCurrency } from "@/lib/utils";
import { createActionForExpense, getOtherPersonKey } from "@/lib/action-lifecycle";

export const GET = withAuth(async () => {
  await connectToDatabase();

  const expenses = await Expense.find()
    .sort({ date: -1, createdAt: -1 })
    .limit(30)
    .populate("tags")
    .lean();

  return NextResponse.json({
    expenses: expenses.map((e) => {
      const tags = (e.tags ?? []) as unknown as Array<{
        _id: mongoose.Types.ObjectId;
        path: string;
        sortOrder: number;
      }>;
      return {
        _id: e._id.toString(),
        paidBy: e.paidBy,
        date: (e.date as Date).toISOString(),
        tags: tags.map(serializeTag),
        amount: e.amount,
        where: e.where,
        notes: e.notes,
        splitType: e.splitType,
        settlementType: e.settlementType,
        createdAt: (e.createdAt as Date).toISOString(),
        updatedAt: (e.updatedAt as Date).toISOString(),
      };
    }),
  });
});

export const POST = withAuth(async (req, session) => {
  const body = await req.json();
  const parsed = expenseApiSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  const { paidBy, date, tagIds, amount, where, notes, splitType, settlementType } =
    parsed.data;

  for (const tagId of tagIds) {
    if (!mongoose.isValidObjectId(tagId)) {
      return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
    }
  }

  await connectToDatabase();

  const settlementError = await assertMonthsOpen([date]);
  if (settlementError) return settlementError;

  const existingTags = await Tag.find({ _id: { $in: tagIds } }).lean();
  if (existingTags.length !== tagIds.length) {
    return NextResponse.json({ error: "One or more tags not found" }, { status: 422 });
  }

  const pathById = new Map(existingTags.map((t) => [String(t._id), t.path as string]));
  const normalizedTagIds = collapseToMostSpecific(tagIds, pathById);

  const expense = await Expense.create({
    paidBy,
    date: new Date(date),
    tags: normalizedTagIds,
    amount,
    where,
    notes,
    splitType,
    settlementType,
  });

  await resetReadinessForMonths(session.user.paidByKey, [date]);

  const tagNames = normalizedTagIds.map((id) => pathById.get(id)).join(", ");
  await logActivity(session.user.paidByKey, "expense_create", `added ${formatCurrency(amount)} at ${where}`, {
    expenseId: expense._id.toString(),
    amount,
    where,
    tagNames,
    paidBy,
    splitType,
  });

  if (expense.settlementType === "immediate") {
    const otherPersonKey = await getOtherPersonKey(expense.paidBy);
    await createActionForExpense(expense, otherPersonKey, session.user.paidByKey);
  }

  const populated = await expense.populate("tags");

  const tags = populated.tags as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    path: string;
    sortOrder: number;
  }>;

  return NextResponse.json(
    {
      expense: {
        _id: populated._id.toString(),
        paidBy: populated.paidBy,
        date: populated.date.toISOString(),
        tags: tags.map(serializeTag),
        amount: populated.amount,
        where: populated.where,
        notes: populated.notes,
        splitType: populated.splitType,
        settlementType: populated.settlementType,
      },
    },
    { status: 201 },
  );
});
