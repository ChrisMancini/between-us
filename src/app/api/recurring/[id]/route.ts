import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { recurringTemplateApiSchema } from "@/lib/validations/recurring-template";
import { withAuth } from "@/lib/auth-guard";
import { validationError, invalidId } from "@/lib/api-utils";
import { serializeTemplate, validateTemplateTagIds } from "@/lib/recurring-template-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PUT = withAuth<RouteContext>(async (req, session, context) => {
  const { id } = await context.params;
  const idErr = invalidId(id);
  if (idErr) return idErr;

  const body = await req.json();
  const parsed = recurringTemplateApiSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  const { name, items } = parsed.data;

  await connectToDatabase();

  const tagError = await validateTemplateTagIds(items);
  if (tagError) return tagError;

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
  const idErr = invalidId(id);
  if (idErr) return idErr;

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
