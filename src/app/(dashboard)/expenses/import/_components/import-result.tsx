"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface ImportResultProps {
  imported: number;
  dateRange: { from: string; to: string };
  totalCents: number;
  onReset: () => void;
}

export function ImportResult({
  imported,
  dateRange,
  totalCents,
  onReset,
}: ImportResultProps) {
  return (
    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-green-100 bg-green-50/60 dark:border-green-800 dark:bg-green-950/50 px-5 py-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
        <div>
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            Import Complete
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            Expenses have been successfully imported.
          </p>
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Expenses</p>
            <p className="text-lg font-semibold tabular-nums">
              {imported.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Date Range</p>
            <p className="text-sm font-medium">
              {dateRange.from} &mdash; {dateRange.to}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatCurrency(totalCents)}
            </p>
          </div>
        </div>
        <div className="pt-2 flex items-center gap-3">
          <Button variant="outline" onClick={onReset}>
            Import Another
          </Button>
          <Link
            href="/expenses"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-2.5 h-8 text-sm font-medium transition-colors hover:bg-primary/80"
          >
            View Expenses
          </Link>
        </div>
      </div>
    </div>
  );
}
