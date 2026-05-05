import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Category } from "@/lib/models/category";
import { categoryReorderSchema } from "@/lib/validations/category";
import { withAdmin } from "@/lib/auth-guard";

export const PUT = withAdmin(async (req) => {
  const body = await req.json();
  const parsed = categoryReorderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { orderedIds } = parsed.data;

  // Validate all IDs are valid ObjectIds
  for (const id of orderedIds) {
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { error: `Invalid category ID: ${id}` },
        { status: 400 }
      );
    }
  }

  await connectToDatabase();

  // Ensure the client sent all categories (prevents partial reorders)
  const total = await Category.countDocuments();
  if (orderedIds.length !== total) {
    return NextResponse.json(
      { error: "Category list is out of date. Please refresh and try again." },
      { status: 422 }
    );
  }

  await Category.bulkWrite(
    orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder: index + 1 } },
      },
    }))
  );

  const categories = await Category.find().sort({ sortOrder: 1 }).lean();

  return NextResponse.json({
    categories: categories.map((c) => ({
      _id: c._id.toString(),
      name: c.name,
      settlementType: c.settlementType,
      sortOrder: c.sortOrder,
    })),
  });
});
