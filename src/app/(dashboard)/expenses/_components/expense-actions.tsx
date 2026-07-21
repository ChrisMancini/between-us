"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { SerializedExpense } from "@/lib/models/expense";
import type { SerializedTag } from "@/lib/models/tag";
import type { SettlementExpenseRow } from "@/lib/settlement-calc";
import { Button } from "@/components/ui/button";
import { EditExpenseDialog } from "./edit-expense-dialog";
import { ExpenseDetailPopover } from "@/components/expense-detail-popover";

interface ExpenseActionsProps {
  expense: SettlementExpenseRow;
  isSettled: boolean;
  currentUserKey?: string;
  tags?: SerializedTag[];
  closedMonthsList?: string[];
  onDelete: (expense: SettlementExpenseRow) => void;
}

export function ExpenseActions({
  expense: e,
  isSettled,
  currentUserKey,
  tags,
  closedMonthsList,
  onDelete,
}: ExpenseActionsProps) {
  const canEdit = !isSettled && currentUserKey && e.paidBy === currentUserKey;

  return (
    <>
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
      {canEdit && (
        <>
          <EditExpenseDialog
            expense={e as SerializedExpense}
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
    </>
  );
}
