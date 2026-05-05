import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { RecurringTemplate, type IRecurringTemplateItem } from "@/lib/models/recurring-template";
import { Category } from "@/lib/models/category";
import { recurringTemplateApiSchema } from "@/lib/validations/recurring-template";
import { withAuth } from "@/lib/auth-guard";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PUT = withAuth<RouteContext>(async (req, session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = recurringTemplateApiSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, items } = parsed.data;

  for (const item of items) {
    if (!mongoose.isValidObjectId(item.categoryId)) {
      return NextResponse.json(
        { error: `Invalid category ID: ${item.categoryId}` },
        { status: 400 }
      );
    }
  }

  await connectToDatabase();

  const categoryIds = [...new Set(items.map((i) => i.categoryId))];
  const existingCategories = await Category.find({
    _id: { $in: categoryIds },
  }).lean();
  if (existingCategories.length !== categoryIds.length) {
    return NextResponse.json(
      { error: "One or more categories not found" },
      { status: 422 }
    );
  }

  const updated = await RecurringTemplate.findOneAndUpdate(
    { _id: id, createdBy: session.user.id },
    { name, items },
    { new: true }
  ).lean();

  if (!updated) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    template: {
      _id: updated._id.toString(),
      name: updated.name,
      items: updated.items.map((item: IRecurringTemplateItem) => ({
        paidBy: item.paidBy,
        categoryId: item.categoryId.toString(),
        amount: item.amount,
        where: item.where,
        notes: item.notes,
        splitType: item.splitType,
      })),
      createdAt: (updated.createdAt as Date).toISOString(),
      updatedAt: (updated.updatedAt as Date).toISOString(),
    },
  });
});

export const DELETE = withAuth<RouteContext>(async (_req, session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  await connectToDatabase();

  const deleted = await RecurringTemplate.findOneAndDelete({
    _id: id,
    createdBy: session.user.id,
  });

  if (!deleted) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
});
