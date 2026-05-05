import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Category } from "@/lib/models/category";
import { CsvFormat } from "@/lib/models/csv-format";
import { Settlement } from "@/lib/models/settlement";
import { seedCategoriesIfEmpty } from "@/lib/category-seed";
import type { SerializedCategory } from "@/lib/models/category";
import type { SerializedCsvFormat } from "@/lib/models/csv-format";
import { CsvImportForm } from "./_components/csv-import-form";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await auth();
  const paidBy = session?.user?.paidByKey ?? "";

  await connectToDatabase();
  await seedCategoriesIfEmpty();

  const [rawCategories, rawFormats, closedSettlements] = await Promise.all([
    Category.find().sort({ sortOrder: 1 }).lean(),
    CsvFormat.find().sort({ name: 1 }).lean(),
    Settlement.find({ status: "closed" }, { month: 1, year: 1, _id: 0 }).lean(),
  ]);

  const categories: SerializedCategory[] = rawCategories.map((c) => ({
    _id: c._id.toString(),
    name: c.name,
    settlementType: c.settlementType,
    sortOrder: c.sortOrder,
  }));

  const formats: SerializedCsvFormat[] = rawFormats.map((f) => ({
    _id: f._id.toString(),
    name: f.name,
    dateColumn: f.dateColumn,
    dateFormat: f.dateFormat,
    descriptionColumn: f.descriptionColumn,
    amountType: f.amountType,
    debitColumn: f.debitColumn,
    creditColumn: f.creditColumn,
    amountColumn: f.amountColumn,
    purchaseSign: f.purchaseSign,
    categoryColumn: f.categoryColumn,
    notesColumn: f.notesColumn,
    categoryMappings: (f.categoryMappings || []).map((m: { sourceValue: string; categoryId: { toString(): string } }) => ({
      sourceValue: m.sourceValue,
      categoryId: m.categoryId.toString(),
    })),
  }));

  const closedMonths = new Set(
    closedSettlements.map((s) => `${s.year}-${s.month}`)
  );

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Import Expenses</h1>
        <p className="text-sm text-muted-foreground">
          Import expenses from a credit card CSV export.
        </p>
      </div>

      <CsvImportForm
        categories={categories}
        formats={formats}
        paidBy={paidBy}
        closedMonths={[...closedMonths]}
      />
    </div>
  );
}
