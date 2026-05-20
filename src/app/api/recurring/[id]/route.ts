import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { Tag } from "@/lib/models/tag";
import { recurringTemplateApiSchema } from "@/lib/validations/recurring-template";
import { withAuth } from "@/lib/auth-guard";
import { validationError } from "@/lib/api-utils";
import { serializeTemplate } from "@/lib/recurring-template-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PUT = withAuth<RouteContext>(async (req, session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

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

  const updated = await RecurringTemplate.findOneAndUpdate(
    { _id: id, createdBy: session.user.id },
    { name, items },
    { new: true },
  ).lean();

  if (!updated) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    template: serializeTemplate(updated),
  });
});

export const DELETE = withAuth<RouteContext>(async (_req, session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  await connectToDatabase();

  const deleted = await RecurringTemplate.findOneAndDelete({
    _id: id,
    createdBy: session.user.id,
  });

  if (!deleted) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
});
