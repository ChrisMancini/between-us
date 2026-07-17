/**
 * Pure duplicate-skip predicate for auto-apply (ADR-0018, decision 3a).
 *
 * When a partner has already logged an expense by hand, auto-apply must not add a
 * second copy. The match is deliberately fuzzy on time and blind to amount: skip an
 * item if an existing expense with the same `where` and one of the item's tags falls
 * within ±3 days of the occurrence date, regardless of amount.
 *
 * The window is proximity to the occurrence, not the calendar month — narrower than
 * the tightest supported spacing (weekly = 7 days), so it absorbs business-day drift
 * and hand-corrected amounts without ever reaching a neighboring occurrence (a
 * biweekly template's two monthly occurrences never skip each other).
 *
 * No DB access: the runner queries candidate expenses and passes them in, keeping
 * this testable in isolation (prior art: `duplicate-check.ts`, a distinct matcher).
 */

/** Occurrence-proximity window, in days on each side of the occurrence date. */
export const DUPLICATE_SKIP_WINDOW_DAYS = 3;

export interface DuplicateSkipItem {
  where: string;
  /** The item's tag ids (collapsed to most specific, as the created expense would carry). */
  tagIds: string[];
}

export interface DuplicateSkipExpense {
  where: string;
  /** The expense's tag ids as strings. */
  tags: string[];
  date: Date;
}

/** `where` comparison is trimmed and case-insensitive so "publix" matches "Publix ". */
function normalizeWhere(where: string): string {
  return where.trim().toLowerCase();
}

/** Whole-day distance between two dates, comparing UTC calendar days only. */
function dayDistance(a: Date, b: Date): number {
  const dayA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const dayB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.abs(Math.round((dayA - dayB) / 86_400_000));
}

/**
 * True if `item` duplicates an already-existing expense near `occurrence`: same
 * `where`, a shared tag, and within ±{@link DUPLICATE_SKIP_WINDOW_DAYS} days. Amount
 * is intentionally ignored.
 */
export function isDuplicateOfExisting(
  item: DuplicateSkipItem,
  occurrence: Date,
  existing: DuplicateSkipExpense[]
): boolean {
  const where = normalizeWhere(item.where);
  const tagIds = new Set(item.tagIds);

  return existing.some(
    (e) =>
      normalizeWhere(e.where) === where &&
      dayDistance(e.date, occurrence) <= DUPLICATE_SKIP_WINDOW_DAYS &&
      e.tags.some((tag) => tagIds.has(tag))
  );
}
