"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SchedulerResult {
  templatesProcessed: number;
  occurrencesApplied: number;
  occurrencesSkipped: number;
  expensesCreated: number;
  alertsRaised: number;
}

export function RunSchedulerButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SchedulerResult | null>(null);

  async function handleRun() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/recurring/run", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to run scheduler");
        return;
      }
      const data: SchedulerResult = await res.json();
      setResult(data);
      const alertSuffix =
        data.alertsRaised > 0
          ? ` — ${data.alertsRaised} alert${data.alertsRaised !== 1 ? "s" : ""}`
          : "";
      toast.success(
        data.occurrencesApplied > 0
          ? `Applied ${data.occurrencesApplied} occurrence${data.occurrencesApplied !== 1 ? "s" : ""} (${data.expensesCreated} expense${data.expensesCreated !== 1 ? "s" : ""})${alertSuffix}`
          : data.alertsRaised > 0
            ? `Nothing applied${alertSuffix}`
            : "Nothing due — everything is up to date"
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleRun} disabled={running} aria-busy={running}>
        {running ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Play className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
        )}
        {running ? "Running…" : "Run scheduler now"}
      </Button>

      {result && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-5">
          <div>
            <dt className="text-xs text-muted-foreground">Templates</dt>
            <dd className="font-semibold tabular-nums">
              {result.templatesProcessed}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Applied</dt>
            <dd className="font-semibold tabular-nums">
              {result.occurrencesApplied}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Skipped</dt>
            <dd className="font-semibold tabular-nums">
              {result.occurrencesSkipped}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Expenses</dt>
            <dd className="font-semibold tabular-nums">
              {result.expensesCreated}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Alerts</dt>
            <dd className="font-semibold tabular-nums">
              {result.alertsRaised}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
