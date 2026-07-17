import { RunSchedulerButton } from "./_components/run-scheduler-button";

export const dynamic = "force-dynamic";

export default function SchedulerPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Scheduler</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Auto-apply recurring templates run on their schedule. Trigger a catch-up
          run on demand below — it is safe to run repeatedly and never
          double-applies.
        </p>
      </div>

      <div className="rounded-xl border border-primary/10 bg-card overflow-hidden shadow-sm">
        <div className="border-b border-primary/10 bg-primary/5 px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
            Recurring auto-apply
          </p>
        </div>
        <div className="px-4 py-4">
          <RunSchedulerButton />
        </div>
      </div>
    </div>
  );
}
