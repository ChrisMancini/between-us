import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RecurringTemplate, type IRecurringTemplateItem } from "@/lib/models/recurring-template";
import { Tag } from "@/lib/models/tag";
import { applyTemplateSchema } from "@/lib/validations/recurring-template";
import { withAuth } from "@/lib/auth-guard";
import { validationError, invalidId } from "@/lib/api-utils";
import { assertMonthsOpen } from "@/lib/settlement-guard";
import { applyTemplateCore } from "@/lib/recurring-apply-core";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAuth<RouteContext>(async (req, session, context) => {
  const { id } = await context.params;
  const idErr = invalidId(id);
  if (idErr) return idErr;

  const body = await req.json();
  const parsed = applyTemplateSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  const { date, items: overrides } = parsed.data;

  await connectToDatabase();

  const template = await RecurringTemplate.findOne({
    _id: id,
    createdBy: session.user.id,
  }).lean();

  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }

  if (overrides.length !== template.items.length) {
    return NextResponse.json(
      { error: "Items count does not match template" },
      { status: 400 },
    );
  }

  const settlementError = await assertMonthsOpen([date]);
  if (settlementError) return settlementError;

  // Validate all tags still exist
  const allTagIds = [
    ...new Set(template.items.flatMap((i: IRecurringTemplateItem) => i.tagIds.map((id) => id.toString()))),
  ];
  const existingTags = await Tag.find({
    _id: { $in: allTagIds },
  }).lean();
  if (existingTags.length !== allTagIds.length) {
    return NextResponse.json(
      { error: "One or more tags in the template no longer exist" },
      { status: 422 },
    );
  }

  const pathById = new Map(existingTags.map((t) => [String(t._id), t.path as string]));

  const { count } = await applyTemplateCore({
    templateId: id,
    templateName: template.name,
    items: template.items,
    amounts: template.items.map((_: IRecurringTemplateItem, i: number) => overrides[i].amount),
    pathById,
    date: new Date(date),
    actorKey: session.user.paidByKey,
  });

  return NextResponse.json({ count }, { status: 201 });
});
