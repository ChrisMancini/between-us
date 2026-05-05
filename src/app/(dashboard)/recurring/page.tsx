import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Category } from "@/lib/models/category";
import { RecurringTemplate, type IRecurringTemplateItem } from "@/lib/models/recurring-template";
import { Settlement } from "@/lib/models/settlement";
import { seedCategoriesIfEmpty } from "@/lib/category-seed";
import type { SerializedCategory } from "@/lib/models/category";
import type { SerializedRecurringTemplate } from "@/lib/models/recurring-template";
import { Button } from "@/components/ui/button";
import { TemplateFormDialog } from "./_components/template-form-dialog";
import { TemplateList } from "./_components/template-list";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const paidBy = session.user.paidByKey ?? "";

  await connectToDatabase();
  await seedCategoriesIfEmpty();

  const [rawCategories, rawTemplates, closedSettlements] = await Promise.all([
    Category.find().sort({ sortOrder: 1 }).lean(),
    RecurringTemplate.find({ createdBy: session.user.id })
      .sort({ name: 1 })
      .lean(),
    Settlement.find({ status: "closed" }, { month: 1, year: 1, _id: 0 }).lean(),
  ]);

  const categories: SerializedCategory[] = rawCategories.map((c) => ({
    _id: c._id.toString(),
    name: c.name,
    settlementType: c.settlementType,
    sortOrder: c.sortOrder,
  }));

  const templates: SerializedRecurringTemplate[] = rawTemplates.map((t) => ({
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
  }));

  const closedMonths = closedSettlements.map((s) => `${s.year}-${s.month}`);

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Recurring</h1>
          <p className="text-sm text-muted-foreground">
            Templates for expenses you enter every month.
          </p>
        </div>

        <TemplateFormDialog
          categories={categories}
          paidBy={paidBy}
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          }
        />
      </div>

      <TemplateList
        templates={templates}
        categories={categories}
        closedMonths={closedMonths}
        paidBy={paidBy}
      />
    </div>
  );
}
