import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { Expense, type IExpense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";

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
