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

interface ExpenseCardProps {
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

export function ExpenseCard({
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
}: ExpenseCardProps) {
  return (
    <div
      className={`px-4 py-3 transition-colors ${
        bulkEditMode ? "focus-ring-inset" : ""
      } ${
        bulkEditMode && isSelected
          ? "bg-primary/5"
          : bulkEditMode
            ? "hover:bg-primary/5"
            : ""
      }`}
      onClick={bulkEditMode ? () => onToggleSelection(e._id) : undefined}
      role={bulkEditMode ? "button" : undefined}
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
      <div className="flex items-start gap-3">
        {bulkEditMode && (
          <div
            className="pt-0.5 shrink-0"
            onClick={(ev) => ev.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelection(e._id)}
              aria-label={`Select expense at ${e.where}`}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Primary: Where + Amount */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground truncate">
              {e.where}
            </span>
            <span className="font-semibold tabular-nums text-foreground shrink-0">
              {formatCurrency(e.amount)}
            </span>
          </div>

          {/* Secondary: Date + Paid by */}
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {formatShortDate(e.date)}
            </span>
            <PersonBadge {...badgeProps(e.paidBy, personMap)} />
          </div>

          {/* Tertiary: Tags + Split + Settled */}
          <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
            {e.tags.map((t) => (
              <Badge
                key={t._id}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 font-medium leading-4"
              >
                {t.path}
              </Badge>
            ))}
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 font-medium leading-4"
            >
              {e.splitType === "split" ? "50/50" : "Full"}
            </Badge>
            {isSettled && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400 font-medium leading-4"
              >
                Settled
              </Badge>
            )}
          </div>
        </div>

        {!bulkEditMode && (
          <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
            <ExpenseActions
              expense={e}
              isSettled={isSettled}
              currentUserKey={currentUserKey}
              tags={tags}
              closedMonthsList={closedMonthsList}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}
