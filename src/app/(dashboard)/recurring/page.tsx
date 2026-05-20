import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Tag } from "@/lib/models/tag";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { Settlement } from "@/lib/models/settlement";
import type { SerializedTag } from "@/lib/models/tag";
import { serializeTag } from "@/lib/tag-utils";
import type { SerializedRecurringTemplate } from "@/lib/models/recurring-template";
import { serializeTemplate } from "@/lib/recurring-template-utils";
import { Button } from "@/components/ui/button";
import { TemplateFormDialog } from "./_components/template-form-dialog";
import { TemplateList } from "./_components/template-list";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const paidBy = session.user.paidByKey ?? "";

  await connectToDatabase();

  const [rawTags, rawTemplates, closedSettlements] = await Promise.all([
    Tag.find().sort({ sortOrder: 1 }).lean(),
    RecurringTemplate.find({ createdBy: session.user.id })
      .sort({ name: 1 })
      .lean(),
    Settlement.find({ status: "closed" }, { month: 1, year: 1, _id: 0 }).lean(),
  ]);

  const tags: SerializedTag[] = rawTags.map((t) => serializeTag(t));

  const templates: SerializedRecurringTemplate[] = rawTemplates.map(serializeTemplate);

  const closedMonths = closedSettlements.map((s) => `${s.year}-${s.month}`);

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Recurring</h1>
          <p className="text-sm text-muted-foreground">
            Templates for expenses you enter every month.
          </p>
        </div>

        <TemplateFormDialog
          tags={tags}
          paidBy={paidBy}
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          }
        />
      </div>

      <TemplateList
        templates={templates}
        tags={tags}
        closedMonths={closedMonths}
        paidBy={paidBy}
      />
    </div>
  );
}
