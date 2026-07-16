import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { recurringTemplateApiSchema } from "@/lib/validations/recurring-template";
import { withAuth } from "@/lib/auth-guard";
import { validationError } from "@/lib/api-utils";
import { serializeTemplate, validateTemplateTagIds, normalizeTemplateItemTagIds } from "@/lib/recurring-template-utils";

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

  await connectToDatabase();

  const tagResult = await validateTemplateTagIds(items);
  if (tagResult.error) return tagResult.error;

  const template = await RecurringTemplate.create({
    name,
    createdBy: session.user.id,
    items: normalizeTemplateItemTagIds(items, tagResult.pathById),
  });

  return NextResponse.json(
    { template: serializeTemplate(template) },
    { status: 201 },
  );
});
