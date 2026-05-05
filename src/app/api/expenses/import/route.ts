import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Category } from "@/lib/models/category";
import { csvImportApiSchema } from "@/lib/validations/csv-import";
import { withAuth } from "@/lib/auth-guard";
import { assertMonthsOpen } from "@/lib/settlement-guard";

export const POST = withAuth(async (req) => {
  const body = await req.json();
  const parsed = csvImportApiSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { expenses } = parsed.data;

  await connectToDatabase();

  // Verify all categories exist
  const uniqueCategoryIds = [...new Set(expenses.map((e) => e.categoryId))];
  const existingCategories = await Category.find({
    _id: { $in: uniqueCategoryIds },
  }).lean();

  if (existingCategories.length !== uniqueCategoryIds.length) {
    return NextResponse.json(
      { error: "One or more categories do not exist" },
      { status: 422 }
    );
  }

  const settlementError = await assertMonthsOpen(expenses.map((e) => e.date));
  if (settlementError) return settlementError;

  // Batch insert
  const docs = expenses.map((e) => ({
    paidBy: e.paidBy,
    date: new Date(e.date),
    category: e.categoryId,
    amount: e.amount,
    where: e.where,
    notes: e.notes,
    splitType: e.splitType,
  }));

  const result = await Expense.insertMany(docs);

  return NextResponse.json({ imported: result.length }, { status: 201 });
});
