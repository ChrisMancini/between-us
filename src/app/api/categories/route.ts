import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/utils";
import { Category } from "@/lib/models/category";
import { seedCategoriesIfEmpty } from "@/lib/category-seed";
import { categoryApiSchema } from "@/lib/validations/category";
import { withAdmin, withAuth } from "@/lib/auth-guard";

export const GET = withAuth(async () => {
  await connectToDatabase();
  await seedCategoriesIfEmpty();

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

export const POST = withAdmin(async (req) => {
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

  // Auto-assign sortOrder to end of list
  const last = await Category.findOne().sort({ sortOrder: -1 }).lean();
  const sortOrder = last ? last.sortOrder + 1 : 1;

  try {
    const category = await Category.create({ name, settlementType, sortOrder });

    return NextResponse.json(
      {
        category: {
          _id: category._id.toString(),
          name: category.name,
          settlementType: category.settlementType,
          sortOrder: category.sortOrder,
        },
      },
      { status: 201 }
    );
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
