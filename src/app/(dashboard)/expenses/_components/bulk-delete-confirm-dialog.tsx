"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import type { SerializedExpense } from "@/lib/models/expense";
import type { BulkDeleteResponse } from "@/types/bulk-expense";
import {
  monthKeyFromDate,
  BulkConfirmResults,
  useBulkConfirmDialog,
} from "./bulk-confirm-shared";

interface BulkDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedExpenses: SerializedExpense[];
  closedMonths: Set<string>;
  currentUserKey: string;
  isAdmin?: boolean;
  onDone: () => void;
}

export function BulkDeleteConfirmDialog({
  open,
  onOpenChange,
  selectedExpenses,
  closedMonths,
  currentUserKey,
  isAdmin = false,
  onDone,
}: BulkDeleteConfirmDialogProps) {
  const { phase, loading, results, handleDone, handleOpenChange, submitBulkAction } =
    useBulkConfirmDialog<BulkDeleteResponse["summary"]>(onDone);

  const canModify = (paidBy: string) => isAdmin || paidBy === currentUserKey;

  const eligible = selectedExpenses.filter(
    (e) => !closedMonths.has(monthKeyFromDate(e.date)) && canModify(e.paidBy),
  );
  const ineligibleCount = selectedExpenses.length - eligible.length;
  const eligibleTotal = eligible.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Dialog open={open} onOpenChange={(next) => handleOpenChange(next, onOpenChange)}>
      <DialogContent className="sm:max-w-md">
        {phase === "confirming" ? (
          <>
            <DialogHeader>
              <DialogTitle>
                Delete {selectedExpenses.length}{" "}
                {selectedExpenses.length === 1 ? "Expense" : "Expenses"}
              </DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2 text-sm">
              {eligible.length > 0 && (
                <p>
                  {eligible.length} {eligible.length === 1 ? "expense" : "expenses"} totaling{" "}
                  <span className="font-medium">{formatCurrency(eligibleTotal)}</span> will be
                  deleted.
                </p>
              )}

              {ineligibleCount > 0 && (
                <p className="text-muted-foreground">
                  {ineligibleCount} {ineligibleCount === 1 ? "expense" : "expenses"} will be
                  skipped (settled or not yours).
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  submitBulkAction({
                    method: "DELETE",
                    body: { expenseIds: selectedExpenses.map((e) => e._id) },
                    fallbackSummary: { deleted: 0, skipped: selectedExpenses.length },
                  })
                }
                disabled={loading || eligible.length === 0}
              >
                {loading ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <BulkConfirmResults
            title="Delete"
            successCount={results?.summary.deleted ?? 0}
            skippedCount={results?.summary.skipped ?? 0}
            results={results?.results ?? null}
            onDone={handleDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
