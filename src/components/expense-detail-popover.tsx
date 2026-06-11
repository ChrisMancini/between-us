"use client";

import { Info, Tags, CalendarDays } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import { formatCurrency } from "@/lib/utils";

interface ExpenseDetailPopoverProps {
  date: string;
  where: string;
  paidBy: string;
  amount: number;
  tags: string;
  splitType: "split" | "full";
  settlementType: "immediate" | "deferred";
  notes?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ExpenseDetailPopover({
  date,
  where,
  paidBy,
  amount,
  tags,
  splitType,
  settlementType,
  notes,
}: ExpenseDetailPopoverProps) {
  const { personMap } = usePersons();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label="Expense details"
          />
        }
      >
        <Info className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="end">
        {/* Header */}
        <div className="border-b border-primary/10 bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{where}</p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {formatCurrency(amount)}
            </p>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatDate(date)}
            </span>
            <PersonBadge {...badgeProps(paidBy, personMap)} />
          </div>
        </div>

        {/* Details */}
        <div className="px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tags className="h-3 w-3" />
              Tags
            </span>
            <span className="text-sm text-foreground">{tags}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Split</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              splitType === "split"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}>
              {splitType === "split" ? "50 / 50" : "Full"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Settlement</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              settlementType === "deferred"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            }`}>
              {settlementType === "immediate" ? "Immediate" : "Deferred"}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div className="border-t border-primary/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1.5">
            Notes
          </p>
          {notes ? (
            <p className="text-sm text-foreground whitespace-pre-wrap">{notes}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">No notes</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
