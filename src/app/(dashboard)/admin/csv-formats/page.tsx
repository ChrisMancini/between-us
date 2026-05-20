import { Plus } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { CsvFormat } from "@/lib/models/csv-format";
import { Tag } from "@/lib/models/tag";
import type { SerializedCsvFormat } from "@/lib/models/csv-format";
import type { SerializedTag } from "@/lib/models/tag";
import { serializeTag } from "@/lib/tag-utils";
import { Button } from "@/components/ui/button";
import { CsvFormatFormDialog } from "./_components/csv-format-form-dialog";
import { CsvFormatList } from "./_components/csv-format-list";

export const dynamic = "force-dynamic";

export default async function CsvFormatsPage() {
  await connectToDatabase();

  const [rawFormats, rawTags] = await Promise.all([
    CsvFormat.find().sort({ name: 1 }).lean(),
    Tag.find().sort({ sortOrder: 1 }).lean(),
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
    tagColumn: f.tagColumn,
    notesColumn: f.notesColumn,
    tagMappings: (f.tagMappings || []).map((m: { sourceValue: string; tagIds: { toString(): string }[] }) => ({
      sourceValue: m.sourceValue,
      tagIds: m.tagIds.map((id) => id.toString()),
    })),
  }));

  const tags: SerializedTag[] = rawTags.map((t) => serializeTag(t));

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
          tags={tags}
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Format
            </Button>
          }
        />
      </div>

      <CsvFormatList formats={formats} tags={tags} />
    </div>
  );
}
