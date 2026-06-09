import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/utils";
import { CsvFormat } from "@/lib/models/csv-format";
import { csvFormatApiSchema } from "@/lib/validations/csv-format";
import { withAdmin } from "@/lib/auth-guard";
import { validationError, invalidId, duplicateKeyResponse } from "@/lib/api-utils";
import { serializeCsvFormat } from "@/lib/csv-format-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PUT = withAdmin<RouteContext>(async (req, _session, context) => {
  const { id } = await context.params;
  const idErr = invalidId(id);
  if (idErr) return idErr;

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
      return duplicateKeyResponse("A format with this name already exists");
    }
    throw err;
  }
});

export const DELETE = withAdmin<RouteContext>(async (_req, _session, context) => {
  const { id } = await context.params;
  const idErr = invalidId(id);
  if (idErr) return idErr;

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
