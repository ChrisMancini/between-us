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
import { formatCurrency } from "@/lib/utils";
import type { SerializedExpense } from "@/lib/models/expense";
import type { BulkDeleteResponse, BulkDeleteResult } from "@/types/bulk-expense";

interface BulkDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedExpenses: SerializedExpense[];
  closedMonths: Set<string>;
  currentUserKey: string;
  isAdmin?: boolean;
  onDone: () => void;
}

const SKIP_REASON_LABELS: Record<string, string> = {
  settled: "month is settled",
  not_owner: "not your expense",
};

function monthKeyFromDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
}

function SkipReasonsList({ results }: { results: BulkDeleteResult[] }) {
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
export function BulkDeleteConfirmDialog({
  open,
  onOpenChange,
  selectedExpenses,
  closedMonths,
  currentUserKey,
  isAdmin = false,
  onDone,
}: BulkDeleteConfirmDialogProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"confirming" | "results">("confirming");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkDeleteResponse | null>(null);

  const canModify = (paidBy: string) => isAdmin || paidBy === currentUserKey;

  const eligible = selectedExpenses.filter(
    (e) => !closedMonths.has(monthKeyFromDate(e.date)) && canModify(e.paidBy),
  );
  const ineligibleCount = selectedExpenses.length - eligible.length;
  const eligibleTotal = eligible.reduce((sum, e) => sum + e.amount, 0);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseIds: selectedExpenses.map((e) => e._id),
        }),
      });

      const data: BulkDeleteResponse = res.ok
        ? await res.json()
        : { results: [], summary: { deleted: 0, skipped: selectedExpenses.length } };

      setResults(data);
      setPhase("results");
      if (res.ok) router.refresh();
    } catch {
      setResults({ results: [], summary: { deleted: 0, skipped: selectedExpenses.length } });
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
                onClick={handleDelete}
                disabled={loading || eligible.length === 0}
              >
                {loading ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Bulk Delete Complete</DialogTitle>
              <DialogDescription>
                {results
                  ? `${results.summary.deleted} ${results.summary.deleted === 1 ? "expense" : "expenses"} deleted${results.summary.skipped > 0 ? `, ${results.summary.skipped} skipped` : ""}.`
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
