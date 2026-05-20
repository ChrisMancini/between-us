import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/utils";
import { CsvFormat } from "@/lib/models/csv-format";
import { csvFormatApiSchema } from "@/lib/validations/csv-format";
import { withAdmin } from "@/lib/auth-guard";
import { validationError } from "@/lib/api-utils";
import { serializeCsvFormat } from "@/lib/csv-format-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PUT = withAdmin<RouteContext>(async (req, _session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = csvFormatApiSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  await connectToDatabase();

  try {
    const updated = await CsvFormat.findByIdAndUpdate(id, parsed.data, {
      new: true,
    }).lean();

    if (!updated) {
      return NextResponse.json(
        { error: "Format not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ format: serializeCsvFormat(updated) });
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        { error: "A format with this name already exists" },
        { status: 409 },
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
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
});
