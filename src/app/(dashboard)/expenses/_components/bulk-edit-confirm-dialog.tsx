"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import type { BulkEditValues, BulkEditResponse, BulkEditResult } from "@/types/bulk-expense";

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

const SKIP_REASON_LABELS: Record<string, string> = {
  settled: "month is settled",
  not_owner: "not your expense",
  no_changes: "no changes needed",
  min_tags: "would remove all tags",
};

function tagNames(tagIds: string[], allTags: SerializedTag[]): string {
  const map = new Map(allTags.map((t) => [t._id, t.path]));
  return tagIds.map((id) => map.get(id) ?? id).join(", ");
}

function monthKeyFromDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
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

function SkipReasonsList({ results }: { results: BulkEditResult[] }) {
  const reasons: Record<string, number> = {};
  for (const r of results) {
    if (r.status === "skipped" && r.reason) {
      reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
    }
  }
  return (
    <div className="text-xs text-muted-foreground space-y-1">
      {Object.entries(reasons).map(([reason, count]) => (
        <p key={reason}>{count} skipped: {SKIP_REASON_LABELS[reason] ?? reason}</p>
      ))}
    </div>
  );
}

// fallow-ignore-next-line complexity
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
  const router = useRouter();
  const [phase, setPhase] = useState<"confirming" | "results">("confirming");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkEditResponse | null>(null);

  const changingSplitOrSettlement =
    values.splitType !== undefined || values.settlementType !== undefined;

  const canModify = (paidBy: string) => isAdmin || paidBy === currentUserKey;

  const ineligibleCount = changingSplitOrSettlement
    ? new Set(
        selectedExpenses
          .filter((e) => closedMonths.has(monthKeyFromDate(e.date)) || !canModify(e.paidBy))
          .map((e) => e._id),
      ).size
    : 0;

  const immediateCount =
    values.settlementType === "immediate"
      ? selectedExpenses.filter(
          (e) =>
            e.settlementType !== "immediate" &&
            !closedMonths.has(monthKeyFromDate(e.date)) &&
            canModify(e.paidBy),
        ).length
      : 0;

  async function handleApply() {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseIds: selectedExpenses.map((e) => e._id),
          ...values,
        }),
      });

      const data: BulkEditResponse = res.ok
        ? await res.json()
        : { results: [], summary: { updated: 0, skipped: selectedExpenses.length } };

      setResults(data);
      setPhase("results");
      if (res.ok) router.refresh();
    } catch {
      setResults({ results: [], summary: { updated: 0, skipped: selectedExpenses.length } });
      setPhase("results");
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    setPhase("confirming");
    setResults(null);
    onDone();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (phase === "results") handleDone(); else onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={loading}>
                {loading ? "Applying…" : "Apply Changes"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Bulk Edit Complete</DialogTitle>
              <DialogDescription>
                {results
                  ? `${results.summary.updated} ${results.summary.updated === 1 ? "expense" : "expenses"} updated${results.summary.skipped > 0 ? `, ${results.summary.skipped} skipped` : ""}.`
                  : "Something went wrong."}
              </DialogDescription>
            </DialogHeader>

            {results && results.summary.skipped > 0 && (
              <SkipReasonsList results={results.results} />
            )}

            <DialogFooter>
              <Button onClick={handleDone}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
