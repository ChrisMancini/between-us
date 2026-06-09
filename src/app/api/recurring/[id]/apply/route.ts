import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { RecurringTemplate, type IRecurringTemplateItem } from "@/lib/models/recurring-template";
import { Tag } from "@/lib/models/tag";
import { Expense, type IExpense } from "@/lib/models/expense";
import { applyTemplateSchema } from "@/lib/validations/recurring-template";
import { withAuth } from "@/lib/auth-guard";
import { validationError } from "@/lib/api-utils";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { logActivity } from "@/lib/activity-logger";
import { resetReadinessForMonths } from "@/lib/readiness-reset";
import { createActionForExpense, getOtherPersonKey } from "@/lib/action-lifecycle";

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

  if (!parsed.success) return validationError(parsed);

  const { date, items: overrides } = parsed.data;

  await connectToDatabase();

  const template = await RecurringTemplate.findOne({
    _id: id,
    createdBy: session.user.id,
  }).lean();

  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }

  if (overrides.length !== template.items.length) {
    return NextResponse.json(
      { error: "Items count does not match template" },
      { status: 400 },
    );
  }

  const settlementError = await assertMonthsOpen([date]);
  if (settlementError) return settlementError;

  // Validate all tags still exist
  const allTagIds = [
    ...new Set(template.items.flatMap((i: IRecurringTemplateItem) => i.tagIds.map((id) => id.toString()))),
  ];
  const existingTags = await Tag.find({
    _id: { $in: allTagIds },
  }).lean();
  if (existingTags.length !== allTagIds.length) {
    return NextResponse.json(
      { error: "One or more tags in the template no longer exist" },
      { status: 422 },
    );
  }

  const expenses = await Expense.insertMany(
    template.items.map((item: IRecurringTemplateItem, i: number) => ({
      paidBy: item.paidBy,
      date: new Date(date),
      tags: item.tagIds,
      amount: overrides[i].amount,
      where: item.where,
      notes: item.notes,
      splitType: item.splitType,
      settlementType: item.settlementType,
    })),
  );

  await resetReadinessForMonths(session.user.paidByKey, [date]);

  const immediateExpenses = expenses.filter((e) => e.settlementType === "immediate");
  for (const expense of immediateExpenses) {
    const otherPersonKey = await getOtherPersonKey(expense.paidBy);
    await createActionForExpense(expense as IExpense, otherPersonKey, session.user.paidByKey);
  }

  await logActivity(session.user.paidByKey, "recurring_apply", `applied "${template.name}" (${expenses.length} expenses)`, {
    templateName: template.name,
    count: expenses.length,
    date,
  });

  return NextResponse.json(
    { count: expenses.length },
    { status: 201 },
  );
});
