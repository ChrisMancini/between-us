import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/utils";
import { CsvFormat } from "@/lib/models/csv-format";
import { csvFormatApiSchema } from "@/lib/validations/csv-format";
import { withAdmin } from "@/lib/auth-guard";
import type { SerializedCsvFormat } from "@/lib/models/csv-format";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

export const PUT = withAdmin<RouteContext>(async (req, _session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

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
    const updated = await CsvFormat.findByIdAndUpdate(id, parsed.data, {
      new: true,
    }).lean();

    if (!updated) {
      return NextResponse.json(
        { error: "Format not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ format: serializeFormat(updated) });
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

export const DELETE = withAdmin<RouteContext>(async (_req, _session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  await connectToDatabase();

  const deleted = await CsvFormat.findByIdAndDelete(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Format not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
});
