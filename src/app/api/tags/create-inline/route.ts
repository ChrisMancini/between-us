import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/utils";
import { Tag } from "@/lib/models/tag";
import { tagApiSchema } from "@/lib/validations/tag";
import { serializeTag, createTagWithSortOrder } from "@/lib/tag-utils";
import { withAuth } from "@/lib/auth-guard";
import { validationError } from "@/lib/api-utils";

export const POST = withAuth(async (req) => {
  const body = await req.json();
  const parsed = tagApiSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  const { path } = parsed.data;

  await connectToDatabase();

  // Check if tag already exists (case-insensitive)
  const existing = await Tag.findOne({ path }).collation({
    locale: "en",
    strength: 2,
  });
  if (existing) {
    return NextResponse.json({ tag: serializeTag(existing) });
  }

  try {
    const tag = await createTagWithSortOrder(path);

    return NextResponse.json({ tag: serializeTag(tag) }, { status: 201 });
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      // Race condition: another request created it between our check and insert
      const found = await Tag.findOne({ path }).collation({
        locale: "en",
        strength: 2,
      });
      if (found) {
        return NextResponse.json({ tag: serializeTag(found) });
      }
    }
    throw err;
  }
});
