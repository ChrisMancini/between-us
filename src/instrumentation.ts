/**
 * Next.js server-startup hook (#75).
 *
 * `register()` runs once when a server instance boots. We use it only to arm the
 * in-process auto-apply timer (ADR-0018, decision 4). Node-only code is imported
 * dynamically inside this function — Next.js calls `register()` in every runtime,
 * including Edge, so the runner (Mongoose, timers) must not be imported at the
 * top level. All scheduling/idempotency logic lives behind the import.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startRecurringScheduler } = await import(
    "@/lib/recurring-scheduler-trigger"
  );
  startRecurringScheduler();
}
