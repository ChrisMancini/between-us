import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { csvImportApiSchema } from "@/lib/validations/csv-import";
import { withAuth } from "@/lib/auth-guard";
import { validationError } from "@/lib/api-utils";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { logActivity } from "@/lib/activity-logger";
import { resetReadinessForMonths } from "@/lib/readiness-reset";

export const POST = withAuth(async (req, session) => {
  const body = await req.json();
  const parsed = csvImportApiSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  const { expenses } = parsed.data;

  await connectToDatabase();

  // Verify all tags exist
  const uniqueTagIds = [...new Set(expenses.flatMap((e) => e.tagIds))];
  const existingTags = await Tag.find({
    _id: { $in: uniqueTagIds },
  }).lean();

  if (existingTags.length !== uniqueTagIds.length) {
    return NextResponse.json(
      { error: "One or more tags do not exist" },
      { status: 422 },
    );
  }

  const settlementError = await assertMonthsOpen(expenses.map((e) => e.date));
  if (settlementError) return settlementError;

  const docs = expenses.map((e) => ({
    paidBy: e.paidBy,
    date: new Date(e.date),
    tags: e.tagIds,
    amount: e.amount,
    where: e.where,
    notes: e.notes,
    splitType: e.splitType,
    settlementType: e.settlementType,
  }));

  const result = await Expense.insertMany(docs);

  await resetReadinessForMonths(session.user.paidByKey, expenses.map((e) => e.date));

  await logActivity(session.user.paidByKey, "csv_import", `imported ${result.length} expenses from CSV`, {
    count: result.length,
  });

  return NextResponse.json({ imported: result.length }, { status: 201 });
});
