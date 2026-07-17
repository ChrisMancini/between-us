import "server-only";

import { connectToDatabase } from "@/lib/db";
import {
  RecurringTemplate,
  type IRecurringTemplateItem,
  type RecurringSchedule,
} from "@/lib/models/recurring-template";
import { RecurringApplyLog } from "@/lib/models/recurring-apply-log";
import { Tag } from "@/lib/models/tag";
import { Expense } from "@/lib/models/expense";
import { getPersons } from "@/lib/persons";
import type { PersonPair } from "@/types/person";
import { areMonthsSettled } from "@/lib/settlement-guard";
import { logActivity } from "@/lib/activity-logger";
import { occurrencesInRange } from "@/lib/recurring-schedule";
import { formatMonthYear } from "@/lib/utils";
import {
  applyTemplateCore,
  type SkippedItemSummary,
} from "@/lib/recurring-apply-core";
import { collapseToMostSpecific } from "@/lib/tag-hierarchy";
import {
  DUPLICATE_SKIP_WINDOW_DAYS,
  isDuplicateOfExisting,
  type DuplicateSkipExpense,
} from "@/lib/recurring-duplicate-skip";

export interface SchedulerResult {
  templatesProcessed: number;
  occurrencesApplied: number;
  occurrencesSkipped: number;
  expensesCreated: number;
  /** Occurrences that couldn't be applied and raised an activity alert (settled month). */
  alertsRaised: number;
}

/**
 * How long a `claimed` ledger entry may sit before another run may steal it
 * (ADR-0018, decision 3; #78). A claim is held only for the seconds it takes to
 * apply an occurrence, so any claim older than this is from a run that died
 * mid-apply (a transient DB blip); the timeout is well above a healthy apply and
 * below the hourly cadence, so a stuck occurrence self-heals on the next run
 * while a genuinely in-flight claim is never stolen.
 */
export const STALE_CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

interface RunnerTemplate {
  _id: unknown;
  name: string;
  createdBy: unknown;
  items: IRecurringTemplateItem[];
  autoApplyEnabled: boolean;
  autoApplyEnabledAt: Date | null;
  schedule: RecurringSchedule | null;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

/**
 * Atomically claim an occurrence in the ledger (ADR-0018, decision 3; #78).
 *
 * Returns true only for the caller that owns the claim. A fresh occurrence is
 * claimed by inserting the ledger document. An occurrence already `completed`, or
 * `claimed` within {@link STALE_CLAIM_TIMEOUT_MS}, is off-limits (returns false),
 * so a healthy in-flight run is never double-applied. An occurrence stuck in
 * `claimed` past the timeout — a run that died after claiming — is atomically
 * stolen and retried; the `claimedAt <= threshold` filter means only one of
 * several concurrent stealers wins.
 */
async function claimOccurrence(
  templateId: unknown,
  occurrenceDate: Date,
  now: Date
): Promise<boolean> {
  try {
    const existing = await RecurringApplyLog.findOneAndUpdate(
      { templateId, occurrenceDate },
      {
        $setOnInsert: {
          templateId,
          occurrenceDate,
          status: "claimed",
          claimedAt: now,
          completedAt: null,
          addedCount: 0,
        },
      },
      { upsert: true, new: false }
    );

    // A null pre-image means we inserted the document and own a fresh claim.
    if (existing === null) return true;

    // Completed never re-runs; a claim younger than the timeout is still in flight.
    const staleThreshold = new Date(now.getTime() - STALE_CLAIM_TIMEOUT_MS);
    const isStaleClaim =
      existing.status === "claimed" &&
      existing.claimedAt != null &&
      new Date(existing.claimedAt) <= staleThreshold;
    if (!isStaleClaim) return false;

    // Steal the stale claim atomically. A concurrent stealer that got here first
    // refreshed `claimedAt`, so the filter no longer matches for us and we back off.
    const stolen = await RecurringApplyLog.findOneAndUpdate(
      {
        templateId,
        occurrenceDate,
        status: "claimed",
        claimedAt: { $lte: staleThreshold },
      },
      { $set: { claimedAt: now } },
      { new: false }
    );
    return stolen !== null;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}

/** Mark a claimed occurrence completed so it never re-runs (ADR-0018, decision 3). */
async function markOccurrenceCompleted(
  templateId: unknown,
  occurrenceDate: Date,
  now: Date,
  addedCount: number
): Promise<void> {
  await RecurringApplyLog.updateOne(
    { templateId, occurrenceDate },
    { $set: { status: "completed", completedAt: now, addedCount } }
  );
}

/**
 * Fetch existing expenses within the duplicate-skip window around an occurrence.
 * A coarse ±N-day DB slice; the pure predicate does the exact per-item matching.
 */
async function findExpensesNearOccurrence(
  occurrence: Date
): Promise<DuplicateSkipExpense[]> {
  const start = new Date(occurrence);
  start.setUTCDate(start.getUTCDate() - DUPLICATE_SKIP_WINDOW_DAYS);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(occurrence);
  end.setUTCDate(end.getUTCDate() + DUPLICATE_SKIP_WINDOW_DAYS);
  end.setUTCHours(23, 59, 59, 999);

  const docs = await Expense.find(
    { date: { $gte: start, $lte: end } },
    { date: 1, where: 1, tags: 1 }
  ).lean();

  return docs.map((e) => ({
    where: e.where as string,
    tags: ((e.tags ?? []) as unknown[]).map((t) => String(t)),
    date: e.date as Date,
  }));
}

/**
 * Apply a single claimed occurrence: create the template's expenses (stored amounts,
 * dated to the occurrence) and mark the ledger entry completed. Items a partner
 * already logged by hand near the occurrence are skipped (ADR-0018, decision 3a);
 * an all-skipped occurrence still writes an activity entry and is marked done.
 * Returns the number of expenses created.
 */
async function applyClaimedOccurrence(
  template: RunnerTemplate,
  occurrence: Date,
  ownerKey: string,
  now: Date
): Promise<number> {
  const tagIds = [
    ...new Set(
      template.items.flatMap((i) => i.tagIds.map((id) => id.toString()))
    ),
  ];
  const tags = await Tag.find({ _id: { $in: tagIds } }).lean();
  const pathById = new Map(tags.map((t) => [String(t._id), t.path as string]));

  const existing = await findExpensesNearOccurrence(occurrence);
  const applied: IRecurringTemplateItem[] = [];
  const amounts: number[] = [];
  const skipped: SkippedItemSummary[] = [];
  for (const item of template.items) {
    const itemTagIds = item.tagIds.map((id) => id.toString());

    // A deleted tag can't be created — skip this item, flag it, and keep going so
    // one broken item doesn't block its siblings (ADR-0018, decision 3a; #78). The
    // occurrence is still marked done: a retry can't resurrect a deleted tag.
    const hasDeletedTag = itemTagIds.some((id) => !pathById.has(id));
    if (hasDeletedTag) {
      skipped.push({ where: item.where, reason: "deleted_tag" });
      continue;
    }

    const collapsedTagIds = collapseToMostSpecific(itemTagIds, pathById);
    const isDuplicate = isDuplicateOfExisting(
      { where: item.where, tagIds: collapsedTagIds },
      occurrence,
      existing
    );
    if (isDuplicate) {
      skipped.push({ where: item.where, reason: "duplicate" });
    } else {
      applied.push(item);
      amounts.push(item.amount);
    }
  }

  const { count } = await applyTemplateCore({
    templateId: String(template._id),
    templateName: template.name,
    items: applied,
    amounts,
    pathById,
    date: occurrence,
    actorKey: ownerKey,
    auto: true,
    skipped,
  });

  await markOccurrenceCompleted(template._id, occurrence, now, count);

  return count;
}

/**
 * Record an activity alert for an occurrence whose month is already settled
 * (ADR-0018, decision 3; #78). Auto-apply never rewrites a settled month and the
 * occurrence is marked done (it won't retry, even if the month is later reopened),
 * so the alert names the exact recovery: reopen the month and apply by hand.
 */
async function logSettledMonthAlert(
  template: RunnerTemplate,
  occurrence: Date,
  ownerKey: string
): Promise<void> {
  const month = occurrence.getUTCMonth() + 1;
  const year = occurrence.getUTCFullYear();
  await logActivity(
    ownerKey,
    "recurring_auto_apply_alert",
    `couldn't auto-apply "${template.name}" — ${formatMonthYear(month, year)} is already settled. Reopen the month and apply this template by hand to add it.`,
    {
      templateId: String(template._id),
      templateName: template.name,
      month,
      year,
      reason: "settled_month",
      // YYYY-MM-DD, matching the apply entry's metadata format.
      date: occurrence.toISOString().slice(0, 10),
    }
  );
}

/**
 * Process one due occurrence: claim it, then either alert (settled month) or apply.
 * Returns whether it was applied, how many expenses it created, and whether it
 * raised an alert.
 *
 * The claim comes first so the settled-month alert is written exactly once (the
 * ledger dedups it) rather than on every hourly run.
 */
async function processOccurrence(
  template: RunnerTemplate,
  occurrence: Date,
  ownerKey: string,
  now: Date
): Promise<{ applied: boolean; count: number; alerted: boolean }> {
  const claimed = await claimOccurrence(template._id, occurrence, now);
  if (!claimed) return { applied: false, count: 0, alerted: false };

  // Never rewrite a settled month (ADR-0018, decision 3). Alert the owner and
  // mark the occurrence done — a retry can't un-settle the month.
  if (await areMonthsSettled([occurrence])) {
    await logSettledMonthAlert(template, occurrence, ownerKey);
    await markOccurrenceCompleted(template._id, occurrence, now, 0);
    return { applied: false, count: 0, alerted: true };
  }

  const count = await applyClaimedOccurrence(template, occurrence, ownerKey, now);
  return { applied: true, count, alerted: false };
}

/** Counter deltas from running one template's due occurrences. */
interface TemplateRunTotals {
  occurrencesApplied: number;
  occurrencesSkipped: number;
  expensesCreated: number;
  alertsRaised: number;
}

/**
 * Run every due occurrence for one auto-enabled template and return its counter
 * deltas. Templates missing a schedule/enablement date, or whose owner can't be
 * resolved, are a no-op (`null`) so the caller doesn't count them as processed.
 */
async function processTemplate(
  template: RunnerTemplate,
  persons: PersonPair,
  now: Date
): Promise<TemplateRunTotals | null> {
  if (!template.schedule || !template.autoApplyEnabledAt) return null;

  const owner = persons.find(
    (p) => String(p._id) === String(template.createdBy)
  );
  if (!owner) return null;

  const totals: TemplateRunTotals = {
    occurrencesApplied: 0,
    occurrencesSkipped: 0,
    expensesCreated: 0,
    alertsRaised: 0,
  };

  const occurrences = occurrencesInRange(
    template.schedule,
    new Date(template.autoApplyEnabledAt),
    now
  );

  for (const occurrence of occurrences) {
    const { applied, count, alerted } = await processOccurrence(
      template,
      occurrence,
      owner.key,
      now
    );
    if (applied) {
      totals.occurrencesApplied += 1;
      totals.expensesCreated += count;
    } else {
      totals.occurrencesSkipped += 1;
    }
    if (alerted) totals.alertsRaised += 1;
  }

  return totals;
}

/**
 * Apply every due, unapplied recurring-template occurrence as of `now`.
 *
 * Correctness comes from the ledger, not from `now` being precise: occurrences
 * missed while the server was down are applied at their real occurrence date on the
 * next run. Occurrences before enablement, in settled months, or already claimed are
 * skipped. This is idempotent — repeated runs create no duplicates.
 */
export async function runScheduler(now: Date): Promise<SchedulerResult> {
  await connectToDatabase();

  const result: SchedulerResult = {
    templatesProcessed: 0,
    occurrencesApplied: 0,
    occurrencesSkipped: 0,
    expensesCreated: 0,
    alertsRaised: 0,
  };

  const templates = (await RecurringTemplate.find({
    autoApplyEnabled: true,
  }).lean()) as unknown as RunnerTemplate[];

  if (templates.length === 0) return result;

  const persons = await getPersons();
  if (!persons) return result;

  for (const template of templates) {
    const totals = await processTemplate(template, persons, now);
    if (!totals) continue;

    result.templatesProcessed += 1;
    result.occurrencesApplied += totals.occurrencesApplied;
    result.occurrencesSkipped += totals.occurrencesSkipped;
    result.expensesCreated += totals.expensesCreated;
    result.alertsRaised += totals.alertsRaised;
  }

  return result;
}
