import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { recurringTemplateApiSchema } from "@/lib/validations/recurring-template";
import { withAuth } from "@/lib/auth-guard";
import { validationError, invalidId } from "@/lib/api-utils";
import { serializeTemplate, validateTemplateTagIds, normalizeTemplateItemTagIds } from "@/lib/recurring-template-utils";
import { schedulesEqual } from "@/lib/recurring-schedule";

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

  const { name, items, autoApplyEnabled, schedule } = parsed.data;

  await connectToDatabase();

  const tagResult = await validateTemplateTagIds(items);
  if (tagResult.error) return tagResult.error;

  const existing = await RecurringTemplate.findOne({
    _id: id,
    createdBy: session.user.id,
  }).lean();

  if (!existing) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }

  const nextSchedule = autoApplyEnabled
    ? (schedule ?? existing.schedule ?? null)
    : null;

  // Re-anchor the enablement moment whenever auto-apply turns on OR its schedule
  // changes while already on. Catch-up runs from this moment, so it never
  // fabricates occurrences from before the feature was enabled (ADR-0018,
  // decision 2a) and a family/param switch adapts going forward instead of
  // backfilling the new schedule's history into open months (story 12, #73). An
  // edit that leaves the schedule untouched keeps the timestamp so
  // genuinely-missed runs still catch up.
  const wasEnabled = existing.autoApplyEnabled === true;
  const scheduleChanged = !schedulesEqual(
    existing.schedule ?? null,
    nextSchedule
  );
  let autoApplyEnabledAt = existing.autoApplyEnabledAt ?? null;
  if (
    autoApplyEnabled &&
    (!wasEnabled || !autoApplyEnabledAt || scheduleChanged)
  ) {
    autoApplyEnabledAt = new Date();
  }

  const updated = await RecurringTemplate.findOneAndUpdate(
    { _id: id, createdBy: session.user.id },
    {
      name,
      items: normalizeTemplateItemTagIds(items, tagResult.pathById),
      autoApplyEnabled,
      autoApplyEnabledAt,
      schedule: nextSchedule,
    },
    { returnDocument: "after" },
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
