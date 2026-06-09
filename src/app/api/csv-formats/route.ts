import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/utils";
import { CsvFormat } from "@/lib/models/csv-format";
import { csvFormatApiSchema } from "@/lib/validations/csv-format";
import { withAdmin, withAuth } from "@/lib/auth-guard";
import { validationError, duplicateKeyResponse } from "@/lib/api-utils";
import { serializeCsvFormat } from "@/lib/csv-format-utils";

export const GET = withAuth(async () => {
  await connectToDatabase();

  const formats = await CsvFormat.find().sort({ name: 1 }).lean();

  return NextResponse.json({
    formats: formats.map(serializeCsvFormat),
  });
});

export const POST = withAdmin(async (req) => {
  const body = await req.json();
  const parsed = csvFormatApiSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  await connectToDatabase();

  try {
    const format = await CsvFormat.create(parsed.data);
    const lean = await CsvFormat.findById(format._id).lean();

    return NextResponse.json(
      { format: serializeCsvFormat(lean!) },
      { status: 201 },
    );
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return duplicateKeyResponse("A format with this name already exists");
    }
    throw err;
  }
});
