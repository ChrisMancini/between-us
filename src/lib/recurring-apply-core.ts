import "server-only";

import { Expense, type IExpense } from "@/lib/models/expense";
import { RecurringTemplate, type IRecurringTemplateItem } from "@/lib/models/recurring-template";
import { logActivity } from "@/lib/activity-logger";
import { resetReadinessForMonths } from "@/lib/readiness-reset";
import { createActionForExpense, getOtherPersonKey } from "@/lib/action-lifecycle";
import { collapseToMostSpecific } from "@/lib/tag-hierarchy";

/**
 * Why auto-apply left an item out of a run:
 * - `duplicate`: a partner already logged it by hand near the occurrence.
 * - `deleted_tag`: one of the item's tags no longer exists, so it can't be created.
 */
export type SkipReason = "duplicate" | "deleted_tag";

/** An item auto-apply left out of a run, with the reason it was omitted. */
export interface SkippedItemSummary {
  where: string;
  reason: SkipReason;
}

export interface ApplyTemplateCoreInput {
  templateId: string;
  templateName: string;
  items: IRecurringTemplateItem[];
  /** Per-item amount in cents, aligned with `items` (overrides for manual apply, stored amounts for auto). */
  amounts: number[];
  /** Tag path lookup used to collapse each item's tags to the most specific. */
  pathById: Map<string, string>;
  /** The date the created expenses are stamped with (UTC). */
  date: Date;
  /** Person key acting as the applier (session user for manual, template owner for auto). */
  actorKey: string;
  /** When true, records the run as `recurring_auto_apply` rather than `recurring_apply`. */
  auto?: boolean;
  /**
   * Items auto-apply left out of this run (duplicates of manual entries, or items
   * whose tag was deleted). Summarized in the consolidated activity entry; when
   * `items` is empty this is the all-skipped case, which still writes an entry so
   * the feed shows the run added nothing on purpose.
   */
  skipped?: SkippedItemSummary[];
}

/**
 * Shared apply-core for recurring templates (ADR-0018, prefactor for #74).
 *
 * Builds the template's expenses from the given amounts, inserts them, bumps the
 * template's apply bookkeeping, resets the actor's month-readiness, creates
 * confirmation Actions for immediate-settlement items, and writes one consolidated
 * activity entry. Both the manual apply route and the auto-apply runner call this;
 * callers own all validation (auth, month-open, tag existence) beforehand.
 */
export async function applyTemplateCore(
  input: ApplyTemplateCoreInput
): Promise<{ count: number; expenses: IExpense[] }> {
  const {
    templateId,
    templateName,
    items,
    amounts,
    pathById,
    date,
    actorKey,
    auto,
    skipped = [],
  } = input;

  // When every item was skipped as a duplicate there is nothing to create — but the
  // run still happened, so it falls through to the consolidated activity entry below.
  const expenses =
    items.length > 0
      ? await Expense.insertMany(
          items.map((item, i) => ({
            paidBy: item.paidBy,
            date,
            tags: collapseToMostSpecific(
              item.tagIds.map((id) => id.toString()),
              pathById
            ),
            amount: amounts[i],
            where: item.where,
            notes: item.notes,
            splitType: item.splitType,
            settlementType: item.settlementType,
          }))
        )
      : [];

  if (expenses.length > 0) {
    await RecurringTemplate.updateOne(
      { _id: templateId },
      { $set: { lastAppliedAt: new Date() }, $inc: { applyCount: 1 } }
    );

    await resetReadinessForMonths(actorKey, [date]);

    const immediateExpenses = expenses.filter(
      (e) => e.settlementType === "immediate"
    );
    for (const expense of immediateExpenses) {
      const otherPersonKey = await getOtherPersonKey(expense.paidBy);
      await createActionForExpense(expense as IExpense, otherPersonKey, actorKey);
    }
  }

  // Duplicates are routine ("skipped"); deleted-tag items need the owner's
  // attention ("flagged"), so they're counted and worded separately.
  const duplicateCount = skipped.filter((s) => s.reason === "duplicate").length;
  const flaggedCount = skipped.filter((s) => s.reason === "deleted_tag").length;

  const verb = auto ? "auto-applied" : "applied";
  let detail: string;
  if (skipped.length === 0) {
    detail = `${expenses.length} expenses`;
  } else {
    const parts = [`${expenses.length} added`];
    if (duplicateCount > 0) parts.push(`${duplicateCount} skipped`);
    if (flaggedCount > 0) parts.push(`${flaggedCount} flagged`);
    detail = parts.join(", ");
  }
  await logActivity(
    actorKey,
    auto ? "recurring_auto_apply" : "recurring_apply",
    `${verb} "${templateName}" (${detail})`,
    {
      templateName,
      templateId,
      count: expenses.length,
      skippedCount: skipped.length,
      flaggedCount,
      skipped,
      // YYYY-MM-DD, matching the manual route's original metadata format.
      date: date.toISOString().slice(0, 10),
    }
  );

  return { count: expenses.length, expenses };
}
