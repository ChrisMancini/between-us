import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/utils";
import { CsvFormat } from "@/lib/models/csv-format";
import { csvFormatApiSchema } from "@/lib/validations/csv-format";
import { withAdmin, withAuth } from "@/lib/auth-guard";
import type { SerializedCsvFormat } from "@/lib/models/csv-format";

function serializeFormat(f: Record<string, unknown>): SerializedCsvFormat {
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
    categoryColumn: f.categoryColumn as string | undefined,
    categoryMappings: ((f.categoryMappings as Array<Record<string, unknown>>) || []).map((m) => ({
      sourceValue: m.sourceValue as string,
      categoryId: String(m.categoryId),
    })),
  };
}

export const GET = withAuth(async () => {
  await connectToDatabase();

  const formats = await CsvFormat.find().sort({ name: 1 }).lean();

  return NextResponse.json({
    formats: formats.map(serializeFormat),
  });
});

export const POST = withAdmin(async (req) => {
  const body = await req.json();
  const parsed = csvFormatApiSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  await connectToDatabase();

  try {
    const format = await CsvFormat.create(parsed.data);
    const lean = await CsvFormat.findById(format._id).lean();

    return NextResponse.json(
      { format: serializeFormat(lean!) },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        { error: "A format with this name already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
});
