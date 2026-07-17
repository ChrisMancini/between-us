# Auto-Apply Recurring Templates

Recurring templates must be applied by hand every month — someone opens the recurring page and clicks "apply." The predictable, fixed expenses (mortgage on the first business day, bills on the 10th, insurance every two Fridays) are exactly the ones that shouldn't need a human. We decided to let a template opt into a schedule and apply itself unattended, with correctness guaranteed by a MongoDB ledger rather than by the trigger. Background research on scheduling approaches for a self-hosted Next.js container is captured in [`docs/research/auto-apply-scheduling.md`](../research/auto-apply-scheduling.md); its central finding — that the trigger is swappable once idempotency lives in the database — shapes decisions 4 and 5 below.

## Decisions

### 1. Auto-apply creates expenses live, acting as the template owner

When a scheduled occurrence fires, expenses are created for real — the same result as manual apply, minus the human. There is no staging or approval step; manual apply already covers the "I want to review it first" case, and a review queue would defeat the purpose of automation. The job has no session, so it acts as the template's `createdBy` person for activity attribution and month-readiness reset, rather than introducing a synthetic "System" actor (which would ripple into every place that assumes activities and readiness belong to a real partner).

Because there is no human to adjust figures, auto-apply uses each item's **stored** `amount`. Templates whose amounts vary month to month (a variable utility bill) simply should not enable auto-apply — the toggle is opt-in per template.

Auto runs are marked in the activity feed as a distinct `recurring_auto_apply` type, shown with a glyph that carries meaning through **shape and text/tooltip, not color** (one user is partially color-blind). Provenance lives in the activity feed only, not on the expense record — marking origin on only the auto path would be inconsistent with manual recurring applies, which are unmarked; expense-level provenance is a separate, broader feature if ever wanted.

### 2. Five schedule families, weekend-only business-day adjustment

Real usage already spans three shapes that no single parameterized rule covers: "first business day of the month" (mortgage), "the 10th" (bills), and "every two Fridays" (insurance, anchored to a biweekly payroll). Biweekly is an interval anchored to a date and drifts across the calendar; a payroll change to "15th and last day" is semi-monthly and locked to the month — these are genuinely different families, and adapting to such a change means switching a template's family, not editing a number.

The schedule is therefore a discriminated union over five families, per-template and opt-in:

1. **Day of month** — 1–31, clamped to the last valid day (so 31 means month-end)
2. **Last day of month**
3. **Nth weekday of month** — e.g. "last Friday"
4. **Semi-monthly** — two fixed days, e.g. 15th and last day
5. **Every N weeks** — anchored to a start date (biweekly)

Business-day adjustment is **weekend-only** ("if it lands on Sat/Sun, roll to the next weekday"). No bank-holiday calendar: settlement is monthly, so the exact day within the month is cosmetic, and a holiday calendar would add a data source, a region setting, and yearly upkeep for effectively no settlement benefit.

### 2a. Enablement is dated; occurrences before it are never invented

Turning auto-apply on stores an effective-from moment (`autoApplyEnabledAt`). Catch-up (decision 3) never considers occurrences dated before that moment, so enabling the feature today cannot retroactively fabricate last week's expenses.

### 3. Idempotency and missed runs live in a MongoDB ledger

Correctness does not depend on the trigger firing reliably. A separate `RecurringApplyLog` collection holds one document per applied occurrence, keyed `(templateId, occurrenceDate)` with a **unique index**. Before applying, the job atomically claims the occurrence via `findOneAndUpdate({ upsert: true })`; the winner applies, everyone else no-ops. This survives container restarts (the claim is in Mongo, not memory) and concurrent/duplicate triggers (the unique index rejects the second writer).

The dedupe unit is the **occurrence date**, not the calendar month — biweekly insurance is correctly allowed to fire twice in one month, but never twice on the same Friday. A calendar-month window would make a schedule's second monthly occurrence collide with its own first.

**Missed runs are backfilled at their real occurrence date.** On startup and on each trigger, the job finds occurrences whose date has passed but that are not yet in the ledger, and applies them dated to the occurrence — so a bill missed during downtime still lands in the correct settlement period. Three guardrails bound this:

- **Open months only.** An occurrence falling in a closed/settled month is never rewritten into that period (the existing `assertMonthsOpen` forbids it); it is skipped and surfaced as an activity alert.
- **After enablement only** (decision 2a).
- **Once each** — falls out of the per-occurrence dedupe automatically.

The ledger entry is **two-state** (`claimed` → `completed`). A transient failure after claiming leaves the occurrence in `claimed`; the catch-up loop retries occurrences stuck in `claimed` past a short timeout, so blips self-heal. A TTL index is not used for lock release — MongoDB's TTL reaper runs only every ~60s and deletion is not immediate, so a `claimedAt`-age check is used instead.

### 3a. Duplicate-skip against manual entries uses an occurrence-proximity window

If a partner manually logs an expense before the schedule fires, auto-apply must not add a second copy. This is a hard skip (no human to warn), decided **per item**: skip an item if a matching expense — **same `where` and the item's tag, ignoring amount** — exists **within ±3 days of the occurrence date**.

The window is proximity to the occurrence, deliberately **not** the calendar month. A month window would break biweekly schedules: the second Friday's expenses would match the first Friday's and wrongly skip themselves. ±3 days is narrower than the tightest supported spacing (weekly = 7 days), so it never reaches a neighboring occurrence, while still absorbing business-day drift (mortgage logged on the 1st, occurrence computed to the 2nd) and a hand-corrected amount. Amount is ignored because for recurring *bills* a same-merchant, same-category charge in the same few days is a near-certain duplicate regardless of amount.

Each occurrence produces **one consolidated activity entry** listing what was added and what was skipped (including an explicit entry when everything was skipped), and the occurrence is marked **done** in the ledger even when nothing was added — the correct outcome was simply "zero new expenses," and it must not retry.

An un-buildable item (its tag was deleted) is skipped individually, the rest of the batch applies, an activity alert names the problem, and the occurrence is marked **done** — retrying cannot resurrect a deleted tag.

### 4. In-process trigger via `instrumentation.ts`

Because decision 3 makes the trigger swappable and the timing requirement is coarse (day-of-month, not seconds), the trigger is chosen for operational simplicity. A timer registered in Next.js's `instrumentation.ts` `register()` hook runs the catch-up job at startup and hourly, gated to production and the Node.js runtime so it does not fire in development. An optional lazy catch-up-on-request may serve as a cheap backstop.

This needs **zero NAS configuration** — the Docker deployment is unchanged — which matters for a single-developer, two-user, always-on app. The usual objection to in-process schedulers ("no missed-run handling") does not apply here because the ledger *is* the missed-run handling. `register()` runs once per server instance; were there ever multiple instances, the atomic claim keeps it safe. An external Synology DSM cron hitting an authenticated route was considered and rejected: it adds a secret, a task to configure, host coupling, and docs, for marginal robustness over an always-on container. If ever needed, swapping it in is just pointing a different trigger at the same idempotent job.

### 5. Configuration in the template dialog; runs surfaced in the activity feed

Auto-apply is configured in the existing template form dialog: a toggle (default off), a schedule-family picker with the relevant params and the weekend-adjust option, plus a plain-English summary and next-run preview ("Applies on the last business day of each month · Next: Aug 1") so a misconfigured schedule is caught before it fires. The template card shows the schedule summary, next occurrence, and last-applied time. Configuration is per template owner, with no admin gating (unlike tag management). Manual apply is untouched and remains available alongside auto. An admin "Run scheduler now" button triggers the idempotent catch-up on demand for testing. All controls are fully keyboard- and mouse-operable.

Immediate-settlement items behave identically to manual apply: the mortgage (an immediate item) auto-creates its confirmation action for the other partner. That is the intended outcome — the same nudge that would otherwise be created by hand.
