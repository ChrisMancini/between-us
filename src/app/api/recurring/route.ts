import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { Tag } from "@/lib/models/tag";
import { recurringTemplateApiSchema } from "@/lib/validations/recurring-template";
import { withAuth } from "@/lib/auth-guard";
import { validationError } from "@/lib/api-utils";
import { serializeTemplate } from "@/lib/recurring-template-utils";

export const GET = withAuth(async (_req, session) => {
  await connectToDatabase();

  const templates = await RecurringTemplate.find({
    createdBy: session.user.id,
  })
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({
    templates: templates.map(serializeTemplate),
  });
});

export const POST = withAuth(async (req, session) => {
  const body = await req.json();
  const parsed = recurringTemplateApiSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  const { name, items } = parsed.data;

  for (const item of items) {
    for (const tagId of item.tagIds) {
      if (!mongoose.isValidObjectId(tagId)) {
        return NextResponse.json(
          { error: `Invalid tag ID: ${tagId}` },
          { status: 400 },
        );
      }
    }
  }

  await connectToDatabase();

  const allTagIds = [...new Set(items.flatMap((i) => i.tagIds))];
  const existingTags = await Tag.find({
    _id: { $in: allTagIds },
  }).lean();
  if (existingTags.length !== allTagIds.length) {
    return NextResponse.json(
      { error: "One or more tags not found" },
      { status: 422 },
    );
  }

  const template = await RecurringTemplate.create({
    name,
    createdBy: session.user.id,
    items,
  });

  return NextResponse.json(
    { template: serializeTemplate(template) },
    { status: 201 },
  );
});
