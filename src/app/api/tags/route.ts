import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/utils";
import { Tag } from "@/lib/models/tag";
import { tagApiSchema } from "@/lib/validations/tag";
import { serializeTag, createTagWithSortOrder } from "@/lib/tag-utils";
import { withAuth } from "@/lib/auth-guard";
import { validationError, duplicateKeyResponse } from "@/lib/api-utils";

export const GET = withAuth(async () => {
  await connectToDatabase();

  const tags = await Tag.find().sort({ sortOrder: 1 }).lean();

  return NextResponse.json({
    tags: tags.map(serializeTag),
  });
});

export const POST = withAuth(async (req) => {
  const body = await req.json();
  const parsed = tagApiSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  const { path } = parsed.data;

  await connectToDatabase();

  try {
    const tag = await createTagWithSortOrder(path);

    return NextResponse.json({ tag: serializeTag(tag) }, { status: 201 });
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return duplicateKeyResponse("A tag with this path already exists");
    }
    throw err;
  }
});
