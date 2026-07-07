"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SKIP_REASON_LABELS: Record<string, string> = {
  settled: "month is settled",
  not_owner: "not your expense",
  no_changes: "no changes needed",
  min_tags: "would remove all tags",
};

export function monthKeyFromDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
}

function SkipReasonsList({
  results,
}: {
  results: Array<{ status: string; reason?: string }>;
}) {
  const reasons: Record<string, number> = {};
  for (const r of results) {
    if (r.status === "skipped" && r.reason) {
      reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
    }
  }
  return (
    <div className="text-xs text-muted-foreground space-y-1">
      {Object.entries(reasons).map(([reason, count]) => (
        <p key={reason}>
          {count} skipped: {SKIP_REASON_LABELS[reason] ?? reason}
        </p>
      ))}
    </div>
  );
}

export function BulkConfirmResults({
  title,
  successCount,
  skippedCount,
  results,
  onDone,
}: {
  title: string;
  successCount: number;
  skippedCount: number;
  results: Array<{ status: string; reason?: string }> | null;
  onDone: () => void;
}) {
  const successLabel = successCount === 1 ? "expense" : "expenses";
  const description = results
    ? `${successCount} ${successLabel} ${title.toLowerCase()}${skippedCount > 0 ? `, ${skippedCount} skipped` : ""}.`
    : "Something went wrong.";

  return (
    <>
      <DialogHeader>
        <DialogTitle>Bulk {title} Complete</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {results && skippedCount > 0 && <SkipReasonsList results={results} />}

      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
}

interface BulkSubmitConfig<T> {
  method: string;
  body: unknown;
  fallbackSummary: T;
}

export function useBulkConfirmDialog<T extends { skipped: number }>(
  onDone: () => void,
) {
  const router = useRouter();
  const [phase, setPhase] = useState<"confirming" | "results">("confirming");
  const [loading, setLoading] = useState(false);
  const [results, setResults] =
    useState<{ results: Array<{ status: string; reason?: string }>; summary: T } | null>(null);

  function handleDone() {
    setPhase("confirming");
    setResults(null);
    onDone();
  }

  function handleOpenChange(nextOpen: boolean, onClose: (open: boolean) => void) {
    if (!nextOpen) {
      if (phase === "results") handleDone();
      else onClose(false);
    }
  }

  async function submitBulkAction(config: BulkSubmitConfig<T>) {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses/bulk", {
        method: config.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.body),
      });

      const data = res.ok
        ? await res.json()
        : { results: [], summary: config.fallbackSummary };

      setResults(data);
      setPhase("results");
      if (res.ok) router.refresh();
    } catch {
      setResults({ results: [], summary: config.fallbackSummary });
      setPhase("results");
    } finally {
      setLoading(false);
    }
  }

  return { phase, loading, results, handleDone, handleOpenChange, submitBulkAction };
}
