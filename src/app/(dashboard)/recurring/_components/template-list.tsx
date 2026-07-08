"use client";

import { useState } from "react";
import { Play, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import type { SerializedTag } from "@/lib/models/tag";
import type { SerializedRecurringTemplate } from "@/lib/models/recurring-template";
import { TemplateFormDialog } from "./template-form-dialog";
import { DeleteDialog } from "@/components/delete-dialog";
import { ApplyTemplateDialog } from "./apply-template-dialog";
import { formatCurrency, formatShortDate } from "@/lib/utils";

interface TemplateListProps {
  templates: SerializedRecurringTemplate[];
  tags: SerializedTag[];
  closedMonths: string[];
  paidBy: string;
}

export function TemplateList({
  templates,
  tags,
  closedMonths,
  paidBy,
}: TemplateListProps) {
  const tagMap = new Map(tags.map((t) => [t._id, t.path]));

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary/20 bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No recurring templates yet. Create one to speed up monthly expense
          entry.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {templates.map((template) => (
        <TemplateCard
          key={template._id}
          template={template}
          tags={tags}
          tagMap={tagMap}
          closedMonths={closedMonths}
          paidBy={paidBy}
        />
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  tags,
  tagMap,
  closedMonths,
  paidBy,
}: {
  template: SerializedRecurringTemplate;
  tags: SerializedTag[];
  tagMap: Map<string, string>;
  closedMonths: string[];
  paidBy: string;
}) {
  const { personMap } = usePersons();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  const total = template.items.reduce((s, i) => s + i.amount, 0);

  return (
    <>
      <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-primary/10 bg-primary/5 px-5 py-3 flex items-start justify-between">
          <p className="font-semibold text-sm text-foreground">
            {template.name}
          </p>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {template.items.length} item{template.items.length !== 1 && "s"}{" "}
              &middot; {formatCurrency(total)}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {template.lastAppliedAt
                ? `Last applied ${formatShortDate(template.lastAppliedAt, { omitCurrentYear: true })} · ${template.applyCount} time${template.applyCount !== 1 ? "s" : ""}`
                : "Never applied"}
            </p>
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 divide-y divide-border">
          {template.items.map((item, i) => (
            <div key={i} className="px-5 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.where}</p>
                <p className="text-xs text-muted-foreground">
                  {item.tagIds.map((id) => tagMap.get(id) ?? "Unknown").join(", ")}
                  {item.notes && ` — ${item.notes}`}
                </p>
              </div>
              <PersonBadge {...badgeProps(item.paidBy, personMap)} className="shrink-0" />
              <span className="shrink-0 text-sm font-semibold tabular-nums w-20 text-right">
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="border-t border-primary/10 bg-muted/50 px-5 py-3 flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <TemplateFormDialog
            tags={tags}
            paidBy={paidBy}
            template={template}
            trigger={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            }
          />
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setApplyOpen(true)}
          >
            <Play className="h-3.5 w-3.5" />
            Apply
          </Button>
        </div>
      </div>

      <DeleteDialog
        endpoint={`/api/recurring/${template._id}`}
        itemType="template"
        itemLabel={template.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />

      <ApplyTemplateDialog
        template={template}
        tags={tags}
        closedMonths={closedMonths}
        open={applyOpen}
        onOpenChange={setApplyOpen}
      />
    </>
  );
}
