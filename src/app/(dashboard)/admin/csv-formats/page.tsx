import { Plus } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { CsvFormat } from "@/lib/models/csv-format";
import { Category } from "@/lib/models/category";
import type { SerializedCsvFormat } from "@/lib/models/csv-format";
import type { SerializedCategory } from "@/lib/models/category";
import { Button } from "@/components/ui/button";
import { CsvFormatFormDialog } from "./_components/csv-format-form-dialog";
import { CsvFormatList } from "./_components/csv-format-list";

export const dynamic = "force-dynamic";

export default async function CsvFormatsPage() {
  await connectToDatabase();

  const [rawFormats, rawCategories] = await Promise.all([
    CsvFormat.find().sort({ name: 1 }).lean(),
    Category.find().sort({ sortOrder: 1 }).lean(),
  ]);

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
          <h2 className="text-lg font-semibold">CSV Formats</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define column mappings for credit card CSV exports.
          </p>
        </div>

        <CsvFormatFormDialog
          categories={categories}
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Format
            </Button>
          }
        />
      </div>

      <CsvFormatList formats={formats} categories={categories} />
    </div>
  );
}
