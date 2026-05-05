"use client";

import { useState } from "react";
import { Play, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import type { SerializedCategory } from "@/lib/models/category";
import type { SerializedRecurringTemplate } from "@/lib/models/recurring-template";
import { TemplateFormDialog } from "./template-form-dialog";
import { DeleteTemplateDialog } from "./delete-template-dialog";
import { ApplyTemplateDialog } from "./apply-template-dialog";

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

interface TemplateListProps {
  templates: SerializedRecurringTemplate[];
  categories: SerializedCategory[];
  closedMonths: string[];
  paidBy: string;
}

export function TemplateList({
  templates,
  categories,
  closedMonths,
  paidBy,
}: TemplateListProps) {
  const categoryMap = new Map(categories.map((c) => [c._id, c.name]));

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
          categories={categories}
          categoryMap={categoryMap}
          closedMonths={closedMonths}
          paidBy={paidBy}
        />
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  categories,
  categoryMap,
  closedMonths,
  paidBy,
}: {
  template: SerializedRecurringTemplate;
  categories: SerializedCategory[];
  categoryMap: Map<string, string>;
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
        <div className="border-b border-primary/10 bg-primary/5 px-5 py-3 flex items-center justify-between">
          <p className="font-semibold text-sm text-foreground">
            {template.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {template.items.length} item{template.items.length !== 1 && "s"}{" "}
            &middot; {fmt(total)}
          </p>
        </div>

        {/* Items list */}
        <div className="flex-1 divide-y divide-border">
          {template.items.map((item, i) => (
            <div key={i} className="px-5 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.where}</p>
                <p className="text-xs text-muted-foreground">
                  {categoryMap.get(item.categoryId) ?? "Unknown"}
                  {item.notes && ` — ${item.notes}`}
                </p>
              </div>
              <PersonBadge {...badgeProps(item.paidBy, personMap)} className="shrink-0" />
              <span className="shrink-0 text-sm font-semibold tabular-nums w-20 text-right">
                {fmt(item.amount)}
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
            categories={categories}
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

      <DeleteTemplateDialog
        templateId={template._id}
        templateName={template.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />

      <ApplyTemplateDialog
        template={template}
        categories={categories}
        closedMonths={closedMonths}
        open={applyOpen}
        onOpenChange={setApplyOpen}
      />
    </>
  );
}
