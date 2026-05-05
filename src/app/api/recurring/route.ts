import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { RecurringTemplate, type IRecurringTemplateItem } from "@/lib/models/recurring-template";
import { Category } from "@/lib/models/category";
import { recurringTemplateApiSchema } from "@/lib/validations/recurring-template";
import { withAuth } from "@/lib/auth-guard";

export const GET = withAuth(async (_req, session) => {
  await connectToDatabase();

  const templates = await RecurringTemplate.find({
    createdBy: session.user.id,
  })
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({
    templates: templates.map((t) => ({
      _id: t._id.toString(),
      name: t.name,
      items: t.items.map((item: IRecurringTemplateItem) => ({
        paidBy: item.paidBy,
        categoryId: item.categoryId.toString(),
        amount: item.amount,
        where: item.where,
        notes: item.notes,
        splitType: item.splitType,
      })),
      createdAt: (t.createdAt as Date).toISOString(),
      updatedAt: (t.updatedAt as Date).toISOString(),
    })),
  });
});

export const POST = withAuth(async (req, session) => {
  const body = await req.json();
  const parsed = recurringTemplateApiSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, items } = parsed.data;

  // Validate all categoryIds
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

  const template = await RecurringTemplate.create({
    name,
    createdBy: session.user.id,
    items,
  });

  return NextResponse.json(
    {
      template: {
        _id: template._id.toString(),
        name: template.name,
        items: template.items.map((item: IRecurringTemplateItem) => ({
          paidBy: item.paidBy,
          categoryId: item.categoryId.toString(),
          amount: item.amount,
          where: item.where,
          notes: item.notes,
          splitType: item.splitType,
        })),
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    },
    { status: 201 }
  );
});
