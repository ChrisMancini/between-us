"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { SerializedExpense } from "@/lib/models/expense";
import type { SerializedTag } from "@/lib/models/tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PersonBadge } from "@/components/person-badge";
import { badgeProps } from "@/lib/person-utils";
import { EditExpenseDialog } from "./edit-expense-dialog";
import { ExpenseDetailPopover } from "@/components/expense-detail-popover";
import type { SerializedPerson } from "@/types/person";

function formatAmount(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface ExpenseRowProps {
  expense: SerializedExpense;
  isSettled: boolean;
  bulkEditMode: boolean;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onDelete: (expense: SerializedExpense) => void;
  currentUserKey?: string;
  tags?: SerializedTag[];
  closedMonthsList?: string[];
  personMap: Map<string, SerializedPerson>;
}

export function ExpenseRow({
  expense: e,
  isSettled,
  bulkEditMode,
  isSelected,
  onToggleSelection,
  onDelete,
  currentUserKey,
  tags,
  closedMonthsList,
  personMap,
}: ExpenseRowProps) {
  return (
    <tr
      className={`hover:bg-primary/5 transition-colors ${bulkEditMode && isSelected ? "bg-primary/5" : ""}`}
      onClick={bulkEditMode ? () => onToggleSelection(e._id) : undefined}
      style={bulkEditMode ? { cursor: "pointer" } : undefined}
    >
      {bulkEditMode && (
        <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelection(e._id)}
            aria-label={`Select expense at ${e.where}`}
          />
        </td>
      )}
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
        {formatDate(e.date)}
      </td>
      <td className="px-4 py-3 font-medium text-foreground">
        <span className="flex items-center gap-2">
          {e.where}
          {isSettled && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400 font-medium leading-4"
            >
              Settled
            </Badge>
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {e.tags.map((t) => t.path).join(", ")}
      </td>
      <td className="px-4 py-3">
        <PersonBadge {...badgeProps(e.paidBy, personMap)} />
      </td>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
        {e.splitType === "split" ? "50 / 50" : "Full"}
      </td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
        {formatAmount(e.amount)}
      </td>
      {!bulkEditMode && (
        <td className="px-2 py-3">
          <div className="flex items-center gap-0.5">
            <ExpenseDetailPopover
              date={e.date}
              where={e.where}
              paidBy={e.paidBy}
              amount={e.amount}
              tags={e.tags.map((t) => t.path).join(", ")}
              splitType={e.splitType}
              settlementType={e.settlementType}
              notes={e.notes}
            />
            {!isSettled && currentUserKey && e.paidBy === currentUserKey && (
              <>
                <EditExpenseDialog
                  expense={e}
                  tags={tags!}
                  closedMonths={closedMonthsList!}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(e)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
