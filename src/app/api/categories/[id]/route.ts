import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/utils";
import { Category } from "@/lib/models/category";
import { Expense } from "@/lib/models/expense";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { categoryApiSchema } from "@/lib/validations/category";
import { withAdmin } from "@/lib/auth-guard";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PUT = withAdmin<RouteContext>(async (req, _session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = categoryApiSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, settlementType } = parsed.data;

  await connectToDatabase();

  try {
    const updated = await Category.findByIdAndUpdate(
      id,
      { name, settlementType },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      category: {
        _id: updated._id.toString(),
        name: updated.name,
        settlementType: updated.settlementType,
        sortOrder: updated.sortOrder,
      },
    });
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
});

export const DELETE = withAdmin<RouteContext>(async (_req, _session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  await connectToDatabase();

  // Check if category is referenced by any expenses or recurring templates
  const [expenseCount, templateCount] = await Promise.all([
    Expense.countDocuments({ category: id }),
    RecurringTemplate.countDocuments({
      "items.categoryId": new mongoose.Types.ObjectId(id),
    }),
  ]);

  if (expenseCount > 0 || templateCount > 0) {
    const parts: string[] = [];
    if (expenseCount > 0) parts.push(`${expenseCount} expense(s)`);
    if (templateCount > 0) parts.push(`${templateCount} template(s)`);
    return NextResponse.json(
      { error: `Cannot delete — category is used by ${parts.join(" and ")}` },
      { status: 409 }
    );
  }

  const deleted = await Category.findByIdAndDelete(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Category not found" },
      { status: 404 }
    );
  }

  // Re-normalize sortOrder to close gaps
  const remaining = await Category.find().sort({ sortOrder: 1 });
  if (remaining.length > 0) {
    await Category.bulkWrite(
      remaining.map((cat, i) => ({
        updateOne: {
          filter: { _id: cat._id },
          update: { $set: { sortOrder: i + 1 } },
        },
      }))
    );
  }

  return NextResponse.json({ ok: true });
});
