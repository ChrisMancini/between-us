import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { RecurringTemplate, type IRecurringTemplateItem } from "@/lib/models/recurring-template";
import { Category } from "@/lib/models/category";
import { Expense } from "@/lib/models/expense";
import { applyTemplateSchema } from "@/lib/validations/recurring-template";
import { withAuth } from "@/lib/auth-guard";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { logActivity } from "@/lib/activity-logger";
import { resetReadinessForMonths } from "@/lib/readiness-reset";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAuth<RouteContext>(async (req, session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = applyTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { date, items: overrides } = parsed.data;

  await connectToDatabase();

  const template = await RecurringTemplate.findOne({
    _id: id,
    createdBy: session.user.id,
  }).lean();

  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 }
    );
  }

  if (overrides.length !== template.items.length) {
    return NextResponse.json(
      { error: "Items count does not match template" },
      { status: 400 }
    );
  }

  const settlementError = await assertMonthsOpen([date]);
  if (settlementError) return settlementError;

  // Validate all categories still exist
  const categoryIds = [
    ...new Set(template.items.map((i: IRecurringTemplateItem) => i.categoryId.toString())),
  ];
  const existingCategories = await Category.find({
    _id: { $in: categoryIds },
  }).lean();
  if (existingCategories.length !== categoryIds.length) {
    return NextResponse.json(
      { error: "One or more categories in the template no longer exist" },
      { status: 422 }
    );
  }

  // Create all expenses
  const expenses = await Expense.insertMany(
    template.items.map((item: IRecurringTemplateItem, i: number) => ({
      paidBy: item.paidBy,
      date: new Date(date),
      category: item.categoryId,
      amount: overrides[i].amount,
      where: item.where,
      notes: item.notes,
      splitType: item.splitType,
    }))
  );

  await resetReadinessForMonths(session.user.paidByKey, [date]);

  await logActivity(session.user.paidByKey, "recurring_apply", `applied "${template.name}" (${expenses.length} expenses)`, {
    templateName: template.name,
    count: expenses.length,
    date,
  });

  return NextResponse.json(
    { count: expenses.length },
    { status: 201 }
  );
});
