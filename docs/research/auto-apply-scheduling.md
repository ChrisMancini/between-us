# Auto-applying recurring templates: scheduling approaches for a self-hosted Next.js app

**Research question:** How to run scheduled/recurring background jobs in a self-hosted Next.js (App Router) app deployed as a single Docker container on a Synology NAS — no serverless, no Vercel.

**Driving feature:** Auto-apply recurring expense templates on a chosen day each month. Exact-second timing does **not** matter. What matters: apply **once**, on or shortly after the target day, **even if the container was briefly down**, and **never double-apply** for a given month.

---

## Bottom line for "Between Us"

For a 2-user, very-low-traffic app where the only hard requirements are "runs once per month even after downtime" and "never double-applies," the winning design is:

> **A cheap in-process trigger (Approach 1) OR host cron (Approach 3) that does nothing but "poke" the app, layered on top of a MongoDB catch-up ledger + atomic idempotency lock (the real workhorse).**

The scheduler you pick is almost irrelevant; the **idempotency ledger in MongoDB is what actually guarantees correctness.** Because the schedule is coarse (a day-of-month, not a precise time), a purely time-based scheduler with no persistence is a poor fit on its own — if the container is down at the scheduled instant, in-memory schedulers (`node-cron`, `croner`) simply skip that run with no catch-up (their state is in-memory only, see below). The ledger fixes that: every trigger asks "is there an unapplied month due as of today?" and the answer survives restarts because it lives in the database.

Concrete recommendation for this app:

1. **Persist a per-month "applied" ledger** in MongoDB (one document per `{templateId, year, month}`), created via an **atomic upsert with a unique index** so two concurrent triggers cannot both apply the same month. This is the correctness guarantee and it is independent of *how* the job is triggered.
2. **Trigger it with whatever is least operational overhead.** Two good options, both fine here:
   - **Approach 1 (in-process via `instrumentation.ts` + a lightweight timer/`croner`):** zero extra infra, everything in one container. Fine because there is exactly one server instance. The timer just calls the same "apply due months" function on a coarse interval (e.g. hourly). Missed runs while down are recovered on next boot because the ledger is checked, not a wall clock.
   - **Approach 3 (Synology DSM Task Scheduler → authenticated API route):** the OS handles scheduling, survives app restarts, and DSM runs the task at the next scheduled time. Slightly more setup (a secret-protected route + a DSM task), but the scheduler is decoupled from the app lifecycle.
3. **Avoid Approach 4 (separate worker container)** — it is the "correct at scale" answer but pure over-engineering for two users and one container. The project's own guidance ("Simplicity — two users, no over-engineering") rules it out.
4. **Approach 2 (lazy "catch-up on request")** is a strong *complement*, not a standalone: because it fires only when someone visits, a month could sit unapplied for days if nobody opens the app. Use it as a **safety net** behind Approach 1 or 3, not the primary trigger.

**Net:** Build the ledger first. Then trigger it with the in-process timer (simplest) or DSM Task Scheduler (most robust). The ledger makes downtime, double-invocation, and dev-reload double-runs all harmless.

---

## Comparison table

| Dimension | 1. In-process scheduler (`instrumentation.ts` + `croner`/`node-cron`) | 2. Catch-up on request (lazy) | 3. Synology DSM Task Scheduler → API route | 4. Separate worker container |
|---|---|---|---|---|
| **Persistence across container restarts** | ❌ Schedule state is in-memory only; lost on restart. Re-registered on next boot via `register()`. | ✅ Nothing to persist — logic runs on the next request. | ✅ Schedule lives in DSM (outside the container). | ❌ Same as #1 unless the worker also uses a persisted ledger. |
| **Missed run while container was DOWN** | ❌ Time-based fire is skipped; **only recovered if you check a persisted ledger on boot/interval** (not by the scheduler). | ⚠️ Recovered on the *next request* — but only if/when someone visits. | ✅ DSM runs the task at its next scheduled time regardless of prior app downtime; combined with a ledger, older missed months are caught up. | ❌ Same as #1 for the timer; ✅ if worker checks a ledger. |
| **Idempotency / double-execution** | ⚠️ Multiple instances or dev reloads can run `register()` more than once → needs a DB lock. | ⚠️ Concurrent requests can race → needs a DB lock. | ✅ Single scheduled invocation, but retries/overlap still need a DB lock. | ⚠️ Needs a DB lock like the others. |
| **Correctness guarantee source** | MongoDB atomic upsert + unique index (see idempotency section) | Same | Same | Same |
| **Operational complexity** | Low — all in one image; but couples job lifecycle to the web server. | Lowest — no scheduler, no extra infra. | Medium — configure a DSM task + a secret-protected route. | Highest — extra container, image, and process to manage. |
| **Fit for 2-user app on Synology NAS** | ✅ Good — matches "one container, simple." | ✅ Good as a safety net; ❌ risky as sole trigger (depends on traffic). | ✅ Good — robust, decoupled, uses the NAS's native scheduler. | ❌ Over-engineered for this scale. |

Legend: ✅ good / ⚠️ works with a caveat (usually "needs the DB lock") / ❌ weak on this dimension.

---

## Approach 1 — In-process scheduler via `instrumentation.ts`

### How `instrumentation.ts` / `register()` actually works

Next.js provides one official server-startup hook: an `instrumentation.ts|js` file at the project root (or inside `src/`) exporting a `register` function.

- **When it runs:** "This function will be called **once** when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests." ([Instrumentation guide](https://nextjs.org/docs/app/guides/instrumentation)) The API reference repeats this: `register` "is called **once** when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests. `register` can be an async function." ([instrumentation.js API reference](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation))
- **Runtime requirement:** "Next.js calls `register` in all environments, so it's important to conditionally import any code that doesn't support specific runtimes (e.g. Edge or Node.js). You can use the `NEXT_RUNTIME` environment variable to get the current environment." Any Node-only work (Mongoose, timers, `node-cron`/`croner`) must be gated behind `process.env.NEXT_RUNTIME === 'nodejs'` and imported dynamically inside `register`. ([Instrumentation guide](https://nextjs.org/docs/app/guides/instrumentation))
- **Recommended pattern:** import side-effecting modules **inside** `register`, not at the top of the file, to "colocate all of your side effects in one place ... and avoid any unintended consequences from importing globally." ([Instrumentation guide](https://nextjs.org/docs/app/guides/instrumentation))
- **Officially blessed for startup code when self-hosting:** the self-hosting guide explicitly notes, under Environment Variables, "You can run code on server startup using the `register` function." ([Self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting))
- **Availability:** `instrumentation` became stable in `v15.0.0` (introduced experimentally in `v13.2.0`). ([instrumentation.js API reference — Version History](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation))

**Caveat about "once per server instance" and multiple instances / dev:** The docs are precise — it runs once **per server instance**, not once per deployment. That has two consequences:

1. **Multiple instances = multiple registrations.** The self-hosting guide's "Multi-Server Deployments" section is built around the fact that each instance/pod is independent ("each pod will have a copy of the cache," "all instances must use the same encryption key"). If you ever run more than one replica, `register()` — and therefore any timer you start in it — runs in **each** one. ([Self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting)) For Between Us this is a single container today, but the DB lock (below) makes it safe regardless.
2. **Dev restarts create new instances.** Because `register` fires whenever "a new Next.js server instance is initiated," a dev server that restarts (or any full server restart) re-runs it. Long-lived timers started here can therefore be created more than once across a dev session. **Do not rely on process-local uniqueness — rely on the DB lock.**

**Next.js has no built-in cron/scheduler.** The only server-lifecycle primitives Next.js documents are `register()` (startup) and [`after()`](https://nextjs.org/docs/app/api-reference/functions/after) (post-response work; "fully supported when self-hosting with `next start`"). There is no first-party recurring-schedule API for self-hosted deployments — Vercel Cron is a platform feature, not part of Next.js core. So an in-process schedule means bringing your own library.

### The scheduler libraries

**`croner`** (recommended if you go in-process): runs in-process/in-memory, zero dependencies, works on Node ≥18. Features include "Target different time zones," "Built-in overrun protection" to prevent overlapping executions, "Built-in error handling," a `maxRuns` option to cap total invocations, and control methods (pause/resume/stop). Its pattern support is 6- or 7-field cron with `L`/`W`/`#` modifiers, and it does **proper DST handling** ("Jobs scheduled during DST gaps are skipped; jobs in DST overlaps run once at first occurrence"). ([croner README](https://github.com/Hexagon/croner), [croner pattern docs](https://croner.56k.guru/usage/pattern/))

**`node-cron`**: also in-process, zero dependencies, standard cron syntax with `L`/`W`/`#`/`?` modifiers, timezone support, overlap prevention, and optional forked-process execution for heavy jobs. Notably it "coordinates but does not persist state to a database," and the docs describe no missed-run/catch-up mechanism. ([node-cron README](https://github.com/node-cron/node-cron))

**Key limitation shared by both:** their schedule and "last run" state is **in-memory only**. If the container is down at the fire time, that run is simply missed — there is no built-in catch-up. This is exactly why the coarse "day of month" requirement pushes you to a persisted ledger rather than trusting the scheduler's wall clock.

**Persistence across restarts:** none inherent. `register()` re-arms the timer on boot, but any run that should have happened while down is gone unless you check the ledger.

**Idempotency:** must be enforced with the DB lock; `register()` can run more than once (multi-instance/dev), and a timer can also fire while a previous run is slow (mitigate with croner's overrun protection *plus* the DB lock).

**Fit:** Good for this app — one container, no extra infra. Use `croner` with a coarse interval (or a daily fire) whose handler calls "apply all due, unapplied months" against the ledger, so timing precision and missed runs stop mattering.

---

## Approach 2 — Catch-up on request (lazy trigger)

**Idea:** No daemon at all. On a route/API hit (e.g., loading the dashboard or an expenses API), check the ledger for any due-but-unapplied month and apply it inline, then continue. Optionally offload the apply to [`after()`](https://nextjs.org/docs/app/api-reference/functions/after) so the response isn't blocked (supported self-hosted with `next start`, and the server drains pending `after()` callbacks on graceful `SIGINT`/`SIGTERM` shutdown per the [self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting)).

- **Persistence across restarts:** ✅ trivially — there is nothing to persist; the check re-runs on the next request and reads durable state from MongoDB.
- **Missed run while down:** ⚠️ recovered, but **only when someone next makes a request.** For a 2-user app that might not be opened for days, a month could apply late. Acceptable as a *backstop*, weak as the *only* mechanism.
- **Idempotency / double-execution:** ⚠️ concurrent requests race to apply the same month; the atomic DB lock makes only one win.
- **Operational complexity:** lowest — no scheduler, no OS config, no extra container.
- **Fit:** Excellent as a **safety net** behind Approach 1 or 3. Not recommended as the sole trigger because delivery depends on traffic.

---

## Approach 3 — Synology DSM Task Scheduler → authenticated API route

**Idea:** Let the NAS's operating system own the schedule. DSM's **Control Panel → Task Scheduler** can create a recurring "Scheduled Task" that runs a **user-defined script** at a chosen frequency (daily/weekly/monthly, at a set time), executing as a chosen user (commonly `root` or a service account). The script issues a single authenticated HTTP call (e.g. `curl` with a shared-secret header) to a Next.js API route that runs "apply all due, unapplied months." ([Synology DSM — Task Scheduler help](https://kb.synology.com/en-us/DSM/help/DSM/AdminCenter/system_taskscheduler))

> Note: Synology's DSM help pages are a client-rendered SPA and could not be text-extracted by the research tooling, so the behaviors above are described from the feature's documented capabilities rather than quoted. Verify exact labels/wording against the live help page linked above for your DSM version (DSM 7.x). The feature lives under Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script, with a Schedule tab offering daily/weekly/monthly recurrence and a run time.

- **Persistence across restarts:** ✅ the schedule lives in DSM, entirely outside the app container. Restarting or redeploying the container does not affect it.
- **Missed run while down:** ✅ DSM fires at its next scheduled time regardless of app uptime; combined with the ledger, any older un-applied month is caught up on the next fire (the route applies *all* due months, not just "today's"). Note: DSM, like standard cron, generally does not "replay" a task whose scheduled instant passed while the **NAS itself** was off — but the ledger + "apply all due" logic still catches those up on the next run.
- **Idempotency / double-execution:** ✅ single scheduled invocation; still guard the route with the DB lock in case of retries, overlapping long runs, or an accidental manual "Run" from the DSM UI.
- **Operational complexity:** medium — you configure one DSM task and one secret-protected route (validate a shared secret header; reject otherwise). Nothing else.
- **Fit:** Very good for this app. It decouples the schedule from the web server's lifecycle and uses infrastructure that is already there (the NAS). This is the most robust option that is still simple.

---

## Approach 4 — Separate worker process / container

**Idea:** A dedicated Node process/container (its own image, or a second service in `docker-compose`) runs the scheduler (`croner`/`node-cron`) and connects to the same MongoDB.

- **Persistence across restarts:** ❌ same as Approach 1 — the timer state is in-memory; correctness still comes from the ledger.
- **Missed run while down:** ❌/✅ — same trade-off as #1; recovered only if the worker checks the ledger on boot/interval.
- **Idempotency:** ⚠️ needs the same DB lock (and if it ever runs alongside the web app's own trigger, the lock is what keeps them from colliding).
- **Operational complexity:** highest — an extra container, image build, deploy, logs, and health to manage.
- **Fit:** ❌ Over-engineered for a 2-user app on a single NAS. This is the right pattern when jobs are heavy, must not compete with request handling, or must scale independently — none of which apply here. The project's CLAUDE.md explicitly optimizes for "Simplicity — two users ... no over-engineering."

---

## Idempotency & lock patterns with MongoDB / Mongoose

This is the part that actually makes any of the four approaches correct. Since MongoDB is already in the stack, use it as both the **idempotency ledger** and the **lock**.

### Pattern A — Per-month "applied" ledger via atomic upsert + unique index (recommended)

Model one document per applied period, e.g. collection `templateApplications` with a compound key `{ templateId, year, month }`.

1. **Add a unique index on the key.** A unique index prevents two documents with the same key from existing, so a second attempt to record the same month fails rather than inserting a duplicate. Uniqueness can be scoped with a partial index if needed: "If you specify both the `partialFilterExpression` and a unique constraint, the unique constraint only applies to the documents that meet the filter expression." ([MongoDB partial indexes](https://www.mongodb.com/docs/manual/core/index-partial/))

2. **Claim the month atomically.** Use `findOneAndUpdate` with `upsert: true` as a compare-and-set: it is an **atomic operation on a single document** — "If a `findOneAndUpdate() operation successfully updates a document, the operation adds an entry on the oplog ... If the operation fails or does not find a document to update, the operation does not add an entry" (all-or-nothing at the document level). The docs also warn: "To avoid multiple upserts, ensure the filter field(s) are uniquely indexed." ([MongoDB findOneAndUpdate](https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndUpdate/)) In Mongoose this "Issues a mongodb findOneAndUpdate command" as a single atomic round-trip, with `upsert` (create if missing) and `new`/`returnDocument: 'after'` options. ([Mongoose Model.findOneAndUpdate](https://mongoosejs.com/docs/api/model.html#Model.findOneAndUpdate()))

**How the claim works (whichever trigger fired it):**
- Compute the set of months that are *due* as of today (target day reached) but have **no** ledger document → this is your **missed-run / catch-up** detection. It is derived from durable DB state, so it is correct after any amount of downtime.
- For each due month, attempt to **claim** it: `findOneAndUpdate({ templateId, year, month, status: { $ne: 'applied' } }, { $set: { status: 'applying', claimedAt: new Date() } }, { upsert: true, new: true })`. Because of the unique index, only one caller can create/claim the document; concurrent triggers (multi-instance, dev double-run, racing requests) that lose the claim simply get a duplicate-key error or see it already `applied` and skip. This is your **double-execution guard**.
- Only after the underlying expenses are written do you set `status: 'applied', appliedAt`. If the process crashes mid-apply, a stale `applying` claim can be reclaimed after a timeout — which is where a TTL or a `claimedAt` age check comes in.

### Pattern B — Lease / lock with a TTL for crash recovery (optional hardening)

If you want an in-flight lock that self-heals if a worker dies mid-run, store a lock document with a date field and a **TTL index**. TTL indexes are "special single-field indexes that MongoDB can use to automatically remove documents from a collection after a certain amount of time or at a specific clock time," expiring documents `expireAfterSeconds` after the indexed date. ([MongoDB TTL indexes](https://www.mongodb.com/docs/manual/core/index-ttl/))

**Important timing caveat for TTL:** deletion is not immediate. "The background task that removes expired documents runs *every 60 seconds*. As a result, documents may remain in a collection during the period between the expiration of the document and the running of the background task," and "The TTL index does not guarantee that expired data is deleted immediately upon expiration." ([MongoDB TTL indexes](https://www.mongodb.com/docs/manual/core/index-ttl/)) So do **not** use TTL as a precise lock-release mechanism. Prefer an explicit `claimedAt`-age check in the `findOneAndUpdate` filter (reclaim a lease only if `claimedAt` is older than N minutes) and treat TTL purely as janitorial cleanup of abandoned locks. For this app, Pattern A's per-month `applied` ledger is enough on its own; Pattern B is only needed if apply operations are long enough to risk a mid-run crash.

### Why this covers every failure mode for Between Us

- **Container was down at the target day:** on the next trigger (boot timer, DSM fire, or a user request) the "due but no ledger doc" query surfaces the missed month and applies it. Correctness comes from the ledger, not the clock.
- **Two triggers at once / multi-instance / dev reload double-run:** the unique index + atomic `findOneAndUpdate` claim means exactly one wins; the rest no-op.
- **Never double-apply a month:** the ledger document (unique per `{templateId, year, month}`) is the permanent record; once `applied`, every future trigger skips it.

---

## Sources

- Next.js — Instrumentation guide: https://nextjs.org/docs/app/guides/instrumentation
- Next.js — `instrumentation.js` API reference (register, runtime, version history): https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
- Next.js — Self-hosting guide (register on startup, `after`, multi-instance behavior, graceful shutdown): https://nextjs.org/docs/app/guides/self-hosting
- Next.js — `after` function reference: https://nextjs.org/docs/app/api-reference/functions/after
- croner — GitHub README (in-process, timezone, overrun protection, maxRuns, error handling): https://github.com/Hexagon/croner
- croner — pattern documentation (6/7-field cron, DST handling): https://croner.56k.guru/usage/pattern/
- node-cron — GitHub README (in-process, overlap prevention, no DB persistence): https://github.com/node-cron/node-cron
- Mongoose — `Model.findOneAndUpdate` API (single atomic findOneAndUpdate command, upsert/new options): https://mongoosejs.com/docs/api/model.html#Model.findOneAndUpdate()
- MongoDB — `db.collection.findOneAndUpdate()` (single-document atomicity, upsert, unique-index guidance): https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndUpdate/
- MongoDB — TTL indexes (60-second background task, non-immediate deletion): https://www.mongodb.com/docs/manual/core/index-ttl/
- MongoDB — Partial indexes (unique + partialFilterExpression scoping): https://www.mongodb.com/docs/manual/core/index-partial/
- Synology — DSM Task Scheduler help (Control Panel → Task Scheduler; user-defined script, recurring schedule): https://kb.synology.com/en-us/DSM/help/DSM/AdminCenter/system_taskscheduler
