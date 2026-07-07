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
import type { SerializedExpense } from "@/lib/models/expense";
import type { SerializedTag } from "@/lib/models/tag";
import type { BulkEditValues, BulkEditResponse } from "@/types/bulk-expense";
import {
  monthKeyFromDate,
  BulkConfirmResults,
  useBulkConfirmDialog,
} from "./bulk-confirm-shared";

interface BulkEditConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedExpenses: SerializedExpense[];
  closedMonths: Set<string>;
  currentUserKey: string;
  isAdmin?: boolean;
  values: BulkEditValues;
  tags: SerializedTag[];
  onDone: () => void;
}

const TAG_MODE_LABELS = { replace: "Replace all with", add: "Add", remove: "Remove" } as const;

function tagNames(tagIds: string[], allTags: SerializedTag[]): string {
  const map = new Map(allTags.map((t) => [t._id, t.path]));
  return tagIds.map((id) => map.get(id) ?? id).join(", ");
}

function computeEligibility(
  expenses: SerializedExpense[],
  closedMonths: Set<string>,
  values: BulkEditValues,
  canModify: (paidBy: string) => boolean,
) {
  const changingSplitOrSettlement =
    values.splitType !== undefined || values.settlementType !== undefined;

  const ineligibleCount = changingSplitOrSettlement
    ? new Set(
        expenses
          .filter((e) => closedMonths.has(monthKeyFromDate(e.date)) || !canModify(e.paidBy))
          .map((e) => e._id),
      ).size
    : 0;

  const immediateCount =
    values.settlementType === "immediate"
      ? expenses.filter(
          (e) =>
            e.settlementType !== "immediate" &&
            !closedMonths.has(monthKeyFromDate(e.date)) &&
            canModify(e.paidBy),
        ).length
      : 0;

  return { ineligibleCount, immediateCount };
}

function ChangeSummary({ values, tags }: { values: BulkEditValues; tags: SerializedTag[] }) {
  return (
    <div className="space-y-2 text-sm">
      {values.tags && (
        <div>
          <span className="font-medium">Tags:</span> {TAG_MODE_LABELS[values.tags.mode]}{" "}
          <span className="text-muted-foreground">{tagNames(values.tags.tagIds, tags)}</span>
        </div>
      )}
      {values.splitType && (
        <div>
          <span className="font-medium">Split type:</span>{" "}
          {values.splitType === "split" ? "50 / 50" : "Full"}
        </div>
      )}
      {values.settlementType && (
        <div>
          <span className="font-medium">Settlement type:</span>{" "}
          {values.settlementType === "deferred" ? "Deferred" : "Immediate"}
        </div>
      )}
    </div>
  );
}

export function BulkEditConfirmDialog({
  open,
  onOpenChange,
  selectedExpenses,
  closedMonths,
  currentUserKey,
  isAdmin = false,
  values,
  tags,
  onDone,
}: BulkEditConfirmDialogProps) {
  const { phase, loading, results, handleDone, handleOpenChange, submitBulkAction } =
    useBulkConfirmDialog<BulkEditResponse["summary"]>(onDone);

  const canModify = (paidBy: string) => isAdmin || paidBy === currentUserKey;
  const { ineligibleCount, immediateCount } =
    computeEligibility(selectedExpenses, closedMonths, values, canModify);

  return (
    <Dialog open={open} onOpenChange={(next) => handleOpenChange(next, onOpenChange)}>
      <DialogContent className="sm:max-w-md">
        {phase === "confirming" ? (
          <>
            <DialogHeader>
              <DialogTitle>
                Bulk Edit {selectedExpenses.length}{" "}
                {selectedExpenses.length === 1 ? "Expense" : "Expenses"}
              </DialogTitle>
              <DialogDescription>Review the changes below before applying.</DialogDescription>
            </DialogHeader>

            <ChangeSummary values={values} tags={tags} />

            {ineligibleCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {ineligibleCount} {ineligibleCount === 1 ? "expense" : "expenses"} will be
                skipped for split/settlement changes (settled or not yours).
              </p>
            )}

            {immediateCount > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This will create {immediateCount} action{" "}
                {immediateCount === 1 ? "item" : "items"} for immediate settlement.
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  submitBulkAction({
                    method: "PATCH",
                    body: { expenseIds: selectedExpenses.map((e) => e._id), ...values },
                    fallbackSummary: { updated: 0, skipped: selectedExpenses.length },
                  })
                }
                disabled={loading}
              >
                {loading ? "Applying…" : "Apply Changes"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <BulkConfirmResults
            title="Edit"
            successCount={results?.summary.updated ?? 0}
            skippedCount={results?.summary.skipped ?? 0}
            results={results?.results ?? null}
            onDone={handleDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
