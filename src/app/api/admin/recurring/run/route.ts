import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-guard";
import { runScheduler } from "@/lib/recurring-runner";

/**
 * Admin "Run scheduler now" trigger (ADR-0018, decision 5).
 *
 * Runs the idempotent catch-up on demand. The automatic in-process trigger is #75;
 * this route lets an admin exercise the runner for testing in the meantime.
 */
export const POST = withAdmin(async () => {
  const result = await runScheduler(new Date());
  return NextResponse.json(result);
});
