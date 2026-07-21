"use client";

import type { SerializedExpense } from "@/lib/models/expense";
import type { SerializedTag } from "@/lib/models/tag";
import type { SettlementExpenseRow } from "@/lib/settlement-calc";
import type { BulkEditValues } from "@/types/bulk-expense";
import { DeleteDialog } from "@/components/delete-dialog";
import { BulkEditConfirmDialog } from "./bulk-edit-confirm-dialog";
import { BulkDeleteConfirmDialog } from "./bulk-delete-confirm-dialog";

interface ExpenseListDialogsProps {
  deleteTarget: SettlementExpenseRow | null;
  onCloseDeleteTarget: () => void;
  confirmValues: BulkEditValues | null;
  onCloseConfirmValues: () => void;
  showDeleteConfirm: boolean;
  onCloseDeleteConfirm: () => void;
  selectedExpenses: SerializedExpense[];
  closedMonths: Set<string>;
  currentUserKey?: string;
  isAdmin: boolean;
  tags?: SerializedTag[];
  onBulkDone: () => void;
}

/**
 * The delete / bulk-edit / bulk-delete dialogs for the expense list. Kept out of
 * ExpenseList so its render stays a straightforward list of the visible surfaces.
 */
export function ExpenseListDialogs({
  deleteTarget,
  onCloseDeleteTarget,
  confirmValues,
  onCloseConfirmValues,
  showDeleteConfirm,
  onCloseDeleteConfirm,
  selectedExpenses,
  closedMonths,
  currentUserKey,
  isAdmin,
  tags,
  onBulkDone,
}: ExpenseListDialogsProps) {
  return (
    <>
      {deleteTarget && (
        <DeleteDialog
          endpoint={`/api/expenses/${deleteTarget._id}`}
          itemType="expense"
          itemLabel={deleteTarget.where}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) onCloseDeleteTarget();
          }}
        />
      )}

      {confirmValues && tags && currentUserKey && (
        <BulkEditConfirmDialog
          open={!!confirmValues}
          onOpenChange={(open) => {
            if (!open) onCloseConfirmValues();
          }}
          selectedExpenses={selectedExpenses}
          closedMonths={closedMonths}
          currentUserKey={currentUserKey}
          isAdmin={isAdmin}
          values={confirmValues}
          tags={tags}
          onDone={onBulkDone}
        />
      )}

      {showDeleteConfirm && currentUserKey && (
        <BulkDeleteConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={(open) => {
            if (!open) onCloseDeleteConfirm();
          }}
          selectedExpenses={selectedExpenses}
          closedMonths={closedMonths}
          currentUserKey={currentUserKey}
          isAdmin={isAdmin}
          onDone={onBulkDone}
        />
      )}
    </>
  );
}
