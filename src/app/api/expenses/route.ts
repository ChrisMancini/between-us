import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Category } from "@/lib/models/category";
import { expenseApiSchema } from "@/lib/validations/expense";
import { withAuth } from "@/lib/auth-guard";
import { assertMonthsOpen } from "@/lib/settlement-guard";

export const GET = withAuth(async () => {
  await connectToDatabase();

  const expenses = await Expense.find()
    .sort({ date: -1, createdAt: -1 })
    .limit(30)
    .populate("category")
    .lean();

  return NextResponse.json({
    expenses: expenses
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
            settlementType: cat.settlementType,
            sortOrder: cat.sortOrder,
          },
          amount: e.amount,
          where: e.where,
          notes: e.notes,
          splitType: e.splitType,
          createdAt: (e.createdAt as Date).toISOString(),
          updatedAt: (e.updatedAt as Date).toISOString(),
        };
      }),
  });
});

export const POST = withAuth(async (req) => {
  const body = await req.json();
  const parsed = expenseApiSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { paidBy, date, categoryId, amount, where, notes, splitType } =
    parsed.data;

  if (!mongoose.isValidObjectId(categoryId)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  await connectToDatabase();

  const settlementError = await assertMonthsOpen([date]);
  if (settlementError) return settlementError;

  const category = await Category.findById(categoryId);
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 422 });
  }

  const expense = await Expense.create({
    paidBy,
    date: new Date(date),
    category: categoryId,
    amount,
    where,
    notes,
    splitType,
  });

  const populated = await expense.populate("category");

  return NextResponse.json(
    {
      expense: {
        _id: populated._id.toString(),
        paidBy: populated.paidBy,
        date: populated.date.toISOString(),
        category: {
          _id: (populated.category as unknown as { _id: mongoose.Types.ObjectId })._id.toString(),
          name: (populated.category as unknown as { name: string }).name,
          settlementType: (populated.category as unknown as { settlementType: string }).settlementType,
          sortOrder: (populated.category as unknown as { sortOrder: number }).sortOrder,
        },
        amount: populated.amount,
        where: populated.where,
        notes: populated.notes,
        splitType: populated.splitType,
      },
    },
    { status: 201 }
  );
});
