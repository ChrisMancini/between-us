import "server-only";

import { runScheduler } from "@/lib/recurring-runner";

/**
 * In-process auto-apply trigger (ADR-0018, decision 4; #75).
 *
 * A timer registered from `instrumentation.ts` fires the idempotent runner at
 * startup and hourly. This adapter carries no business logic: all correctness
 * (exactly-once apply, missed-run backfill, settled-month refusal) lives in the
 * runner's ledger, so the trigger only needs to be coarse and best-effort. The
 * "Run scheduler now" admin route calls the same runner and is unaffected.
 */

const HOURLY_MS = 60 * 60 * 1000;

// The timer handle doubles as the "already armed" guard. `register()` can run
// more than once (dev restarts, multiple server instances), so we key off a
// value that survives module re-evaluation within a process.
const globalForScheduler = globalThis as typeof globalThis & {
  __recurringSchedulerTimer?: ReturnType<typeof setInterval>;
};

/**
 * Fire the runner once, swallowing errors so a transient failure never tears
 * down the timer — the ledger makes the next hourly run a safe retry.
 */
async function fireOnce(): Promise<void> {
  try {
    const result = await runScheduler(new Date());
    if (result.occurrencesApplied > 0) {
      console.info(
        `[recurring-scheduler] applied ${result.occurrencesApplied} occurrence(s), ${result.expensesCreated} expense(s)`
      );
    }
  } catch (err) {
    console.error("[recurring-scheduler] run failed:", err);
  }
}

/**
 * Arm the hourly auto-apply timer and run an immediate startup catch-up.
 *
 * No-ops (returning `false`) outside the Node.js runtime, outside production, or
 * if a timer is already armed in this process. Returns `true` when it arms the
 * timer, so the caller/tests can assert the gating.
 */
export function startRecurringScheduler(): boolean {
  // Node.js runtime only — the runner uses Mongoose and timers, which the Edge
  // runtime does not support. Next.js calls `register()` in every runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return false;
  // Production only — never apply expenses automatically during development.
  if (process.env.NODE_ENV !== "production") return false;
  // Already armed in this process; don't stack timers.
  if (globalForScheduler.__recurringSchedulerTimer) return false;

  const timer = setInterval(() => {
    void fireOnce();
  }, HOURLY_MS);
  // Don't hold the process open solely for this timer.
  timer.unref?.();
  globalForScheduler.__recurringSchedulerTimer = timer;

  // Startup catch-up: apply anything that came due while the server was down.
  void fireOnce();

  return true;
}
