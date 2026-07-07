import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { Expense, type IExpense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { Tag } from "@/lib/models/tag";

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
}

export function validateExpenseIds(ids: string[]): NextResponse | null {
  for (const id of ids) {
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: `Invalid expense ID: ${id}` }, { status: 400 });
    }
  }
  return null;
}

export async function validateTagIds(
  tags: { tagIds: string[] } | undefined,
): Promise<NextResponse | null> {
  if (!tags) return null;

  for (const tagId of tags.tagIds) {
    if (!mongoose.isValidObjectId(tagId)) {
      return NextResponse.json({ error: `Invalid tag ID: ${tagId}` }, { status: 400 });
    }
  }

  const foundTags = await Tag.find({ _id: { $in: tags.tagIds } }).lean();
  if (foundTags.length !== tags.tagIds.length) {
    return NextResponse.json({ error: "One or more tags not found" }, { status: 422 });
  }

  return null;
}

export async function fetchExpensesAndClosedMonths(
  expenseIds: string[],
): Promise<{ expenses: IExpense[]; closedMonths: Set<string> }> {
  const expenses = await Expense.find({ _id: { $in: expenseIds } });

  const expenseDates = expenses.map((e) => e.date);
  const monthKeys = [...new Set(expenseDates.map((d) => monthKey(d)))];
  const monthPairs = monthKeys.map((k) => {
    const [year, month] = k.split("-").map(Number);
    return { month, year };
  });

  const closedSettlements = await Settlement.find({
    $or: monthPairs.map(({ month, year }) => ({ month, year, status: { $ne: "open" } })),
  }).lean();

  const closedMonths = new Set(closedSettlements.map((s) => `${s.year}-${s.month}`));

  return { expenses, closedMonths };
}
