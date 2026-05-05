import { Plus } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Category } from "@/lib/models/category";
import { seedCategoriesIfEmpty } from "@/lib/category-seed";
import type { SerializedCategory } from "@/lib/models/category";
import { Button } from "@/components/ui/button";
import { CategoryFormDialog } from "./_components/category-form-dialog";
import { CategoryList } from "./_components/category-list";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await connectToDatabase();
  await seedCategoriesIfEmpty();

  const rawCategories = await Category.find().sort({ sortOrder: 1 }).lean();

  const categories: SerializedCategory[] = rawCategories.map((c) => ({
    _id: c._id.toString(),
    name: c.name,
    settlementType: c.settlementType,
    sortOrder: c.sortOrder,
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Categories</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add, edit, reorder, or remove expense categories.
          </p>
        </div>

        <CategoryFormDialog
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          }
        />
      </div>

      <CategoryList categories={categories} />
    </div>
  );
}
