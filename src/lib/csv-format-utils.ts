import type { SerializedCsvFormat } from "./models/csv-format";

export function serializeCsvFormat(
  f: Record<string, unknown>
): SerializedCsvFormat {
  return {
    _id: String(f._id),
    name: f.name as string,
    dateColumn: f.dateColumn as string,
    dateFormat: f.dateFormat as SerializedCsvFormat["dateFormat"],
    descriptionColumn: f.descriptionColumn as string,
    amountType: f.amountType as SerializedCsvFormat["amountType"],
    debitColumn: f.debitColumn as string | undefined,
    creditColumn: f.creditColumn as string | undefined,
    amountColumn: f.amountColumn as string | undefined,
    purchaseSign: f.purchaseSign as SerializedCsvFormat["purchaseSign"],
    tagColumn: f.tagColumn as string | undefined,
    notesColumn: f.notesColumn as string | undefined,
    tagMappings: (
      (f.tagMappings as Array<Record<string, unknown>>) || []
    ).map((m) => ({
      sourceValue: m.sourceValue as string,
      tagIds: ((m.tagIds as Array<unknown>) || []).map(String),
    })),
  };
}
