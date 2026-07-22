"use client";

import type { SerializedTag } from "@/lib/models/tag";
import type { SettlementExpenseRow } from "@/lib/settlement-calc";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PersonBadge } from "@/components/person-badge";
import { badgeProps } from "@/lib/person-utils";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { ExpenseActions } from "./expense-actions";
import type { SerializedPerson } from "@/types/person";

interface ExpenseRowProps {
  expense: SettlementExpenseRow;
  isSettled: boolean;
  bulkEditMode: boolean;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onDelete: (expense: SettlementExpenseRow) => void;
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
      className={`transition-colors hover:bg-primary/5 ${
        bulkEditMode ? "cursor-pointer focus-ring-inset" : ""
      } ${bulkEditMode && isSelected ? "bg-primary/5" : ""}`}
      onClick={bulkEditMode ? () => onToggleSelection(e._id) : undefined}
      tabIndex={bulkEditMode ? 0 : undefined}
      onKeyDown={
        bulkEditMode
          ? (ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onToggleSelection(e._id);
              }
            }
          : undefined
      }
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
        {formatShortDate(e.date)}
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
        {formatCurrency(e.amount)}
      </td>
      {!bulkEditMode && (
        <td className="px-2 py-3">
          <div className="flex items-center gap-0.5">
            <ExpenseActions
              expense={e}
              isSettled={isSettled}
              currentUserKey={currentUserKey}
              tags={tags}
              closedMonthsList={closedMonthsList}
              onDelete={onDelete}
            />
          </div>
        </td>
      )}
    </tr>
  );
}
