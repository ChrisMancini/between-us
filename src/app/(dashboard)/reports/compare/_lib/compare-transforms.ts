// Diff transform for the Month-over-Month Comparison view (spec #48, tracer
// bullet #49). Turns two months' `TagTotal[]` (one per selected month, produced
// by the existing `buildTagTotals`) into a flat list of per-parent-tag movers.
//
// This is the one genuinely new logic module for the compare view, so it is
// where every decision-rich rule lives — and where the tests live. It is a pure
// function: totals in, structures out. No DB, no formatting (that is
// `delta-format.ts`), no rendering.
//
// Scope note: the tracer bullet (#49) produced a single flat list rolled up to
// the top-level parent tag, with a combined household headline. #50 adds the
// Deferred/Immediate section split below (`splitBySettlementType` +
// `buildSectionedComparison`). Mover dimming and drill-down arrive in later
// tickets.
import { buildTagTotals, type TagTotal } from "../../_lib/report-transforms";

// up/down/steady describe a tag present in both months; new/gone describe a tag
// present in only one. Direction is carried by `status` + `delta`, never color.
export type CompareStatus = "up" | "down" | "steady" | "new" | "gone";

// Per-person spend for one tag in one month, carried through for the later
// drill-down "who paid" block. `null` on a row's `from`/`to` means the tag had
// no spend that month (renders as `—`).
export interface PersonMonth {
  person1Paid: number;
  person2Paid: number;
  total: number;
}

export interface CompareRow {
  /** Parent path — the top-level tag segment (e.g. "Bills"). */
  path: string;
  /** Display name; for a top-level parent this equals the path. */
  name: string;
  /** The parent tag's `sortOrder`, used only as the sort tie-break. */
  sortOrder: number;
  fromTotal: number;
  toTotal: number;
  /** to − from (cents). Positive = more in the comparison month. */
  delta: number;
  /** Secondary context only; never reorders. `null` when suppressed. */
  pct: number | null;
  status: CompareStatus;
  from: PersonMonth | null;
  to: PersonMonth | null;
}

export interface HeadlineTotals {
  fromTotal: number;
  toTotal: number;
  delta: number;
  pct: number | null;
  status: CompareStatus;
}

interface TagLean {
  path: string;
  sortOrder: number;
}

const SENTINEL_SORT_ORDER = Number.MAX_SAFE_INTEGER;

/** Top-level segment of a tag path: "Bills/Electric" → "Bills". */
function parentOf(path: string): string {
  const slash = path.indexOf("/");
  return slash === -1 ? path : path.slice(0, slash);
}

/**
 * Pure prefix-sum by path: a parent's total is the sum of every tag whose path
 * equals the parent or is prefixed by `parent + "/"`. Returns `null` when the
 * parent has no spend in these totals (so the caller can mark it new/gone).
 *
 * An expense co-tagged with both a parent and one of its children counts once
 * per tag (the existing `$unwind` semantics), so it is included twice here. That
 * double-count is accepted: it matches `/reports`, is consistent month-to-month,
 * and largely cancels in the delta. We deliberately do not de-dupe.
 */
function rollup(totals: TagTotal[], parent: string): PersonMonth | null {
  const prefix = parent + "/";
  let person1Paid = 0;
  let person2Paid = 0;
  let total = 0;
  let present = false;

  for (const t of totals) {
    if (t.tagPath === parent || t.tagPath.startsWith(prefix)) {
      person1Paid += t.person1Paid;
      person2Paid += t.person2Paid;
      total += t.total;
      if (t.total > 0) present = true;
    }
  }

  return present ? { person1Paid, person2Paid, total } : null;
}

/** Classify a from/to pair into a status from presence and the signed delta. */
function classify(fromPresent: boolean, toPresent: boolean, delta: number): CompareStatus {
  if (!fromPresent && toPresent) return "new";
  if (fromPresent && !toPresent) return "gone";
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "steady";
}

/** Percentage change, or `null` when suppressed (new/gone or zero baseline). */
function percentage(status: CompareStatus, fromTotal: number, delta: number): number | null {
  if (status === "new" || status === "gone") return null;
  if (fromTotal <= 0) return null;
  return (delta / fromTotal) * 100;
}

/**
 * The parent's own `sortOrder` if a Tag entity exists at that exact path;
 * otherwise the smallest `sortOrder` among its descendants so a prefix-only
 * parent sorts near its children; otherwise a large sentinel.
 */
function parentSortOrder(parent: string, allTags: TagLean[]): number {
  const prefix = parent + "/";
  let min = SENTINEL_SORT_ORDER;
  for (const t of allTags) {
    if (t.path === parent) return t.sortOrder;
    if (t.path.startsWith(prefix)) min = Math.min(min, t.sortOrder);
  }
  return min;
}

/**
 * Sort movers by absolute dollar change descending (the sole sort key), with the
 * tag's `sortOrder` as the tie-break. Increases and decreases are interleaved in
 * one list. Percentage never reorders. Sorts in place.
 */
export function sortMovers(rows: CompareRow[]): void {
  rows.sort((a, b) => {
    const byMagnitude = Math.abs(b.delta) - Math.abs(a.delta);
    if (byMagnitude !== 0) return byMagnitude;
    return a.sortOrder - b.sortOrder;
  });
}

/**
 * Build the flat list of per-parent-tag movers comparing two months.
 *
 * @param fromTotals baseline month tag totals (from `buildTagTotals`)
 * @param toTotals   comparison month tag totals
 * @param allTags    tag entities, for the `sortOrder` tie-break
 */
export function buildComparison(
  fromTotals: TagTotal[],
  toTotals: TagTotal[],
  allTags: TagLean[]
): CompareRow[] {
  // Parents present (i.e. with spend) in either month. A parent that exists only
  // as a path prefix — no Tag entity at that exact path — still appears, because
  // presence is driven by the rollup, not by whether a parent Tag exists.
  const parents = new Set<string>();
  for (const t of fromTotals) if (t.total > 0) parents.add(parentOf(t.tagPath));
  for (const t of toTotals) if (t.total > 0) parents.add(parentOf(t.tagPath));

  const rows: CompareRow[] = [];
  for (const parent of parents) {
    const from = rollup(fromTotals, parent);
    const to = rollup(toTotals, parent);
    const fromTotal = from?.total ?? 0;
    const toTotal = to?.total ?? 0;
    const delta = toTotal - fromTotal;
    const status = classify(from !== null, to !== null, delta);

    rows.push({
      path: parent,
      name: parent,
      sortOrder: parentSortOrder(parent, allTags),
      fromTotal,
      toTotal,
      delta,
      pct: percentage(status, fromTotal, delta),
      status,
      from,
      to,
    });
  }

  sortMovers(rows);
  return rows;
}

/**
 * The combined household headline: one total per month (deferred + immediate
 * together), summed from the movers so the top line reconciles with the list
 * below. No per-person figures — this line reads as "our shared life changed by
 * X", never as scorekeeping.
 */
export function buildHeadline(rows: CompareRow[]): HeadlineTotals {
  const fromTotal = rows.reduce((sum, r) => sum + r.fromTotal, 0);
  const toTotal = rows.reduce((sum, r) => sum + r.toTotal, 0);
  const delta = toTotal - fromTotal;
  const status = classify(fromTotal > 0, toTotal > 0, delta);

  return {
    fromTotal,
    toTotal,
    delta,
    pct: percentage(status, fromTotal, delta),
    status,
  };
}

// --- Settlement-type split (#50) -------------------------------------------
//
// The comparison splits into two honest sections — Deferred and Immediate — so
// already-settled spend (e.g. the mortgage) is separated from spend that
// accumulates into the monthly settlement. Settlement type comes from the
// aggregation `_id` (see `tagPersonSettlementPipeline`), never from
// `TagTotal.settlementType`, which `buildTagTotals` hardcodes to "deferred".

export type SettlementType = "deferred" | "immediate";

/** A row shaped like `tagPersonSettlementPipeline` emits. */
export interface SettlementAggRow {
  _id: {
    tagPath: string;
    tagSortOrder: number;
    paidBy: string;
    settlementType: SettlementType;
  };
  total: number;
}

/** One month's tag totals, partitioned by settlement type. */
export interface SettlementSplit {
  deferred: TagTotal[];
  immediate: TagTotal[];
}

export interface SettlementSection {
  settlementType: SettlementType;
  /** Movers for this section, already rolled up and sorted by |delta|. */
  rows: CompareRow[];
  /** This section's own `from → to` subtotal, in the same shape as the headline. */
  subtotal: HeadlineTotals;
}

export interface SectionedComparison {
  deferred: SettlementSection;
  immediate: SettlementSection;
  /** Combined household total = deferred + immediate together. */
  headline: HeadlineTotals;
}

/**
 * Partition one month's settlement-aware aggregation rows into deferred and
 * immediate `TagTotal[]`, reusing `buildTagTotals` for each bucket. This is the
 * only place settlement type is read — from the aggregation `_id`, so the split
 * is trustworthy where `TagTotal.settlementType` is not.
 */
export function splitBySettlementType(
  agg: SettlementAggRow[],
  allTags: TagLean[],
  person1Key: string
): SettlementSplit {
  const deferred = agg.filter((r) => r._id.settlementType === "deferred");
  const immediate = agg.filter((r) => r._id.settlementType === "immediate");
  return {
    deferred: buildTagTotals(deferred, allTags, person1Key),
    immediate: buildTagTotals(immediate, allTags, person1Key),
  };
}

function buildSection(
  settlementType: SettlementType,
  fromTotals: TagTotal[],
  toTotals: TagTotal[],
  allTags: TagLean[]
): SettlementSection {
  const rows = buildComparison(fromTotals, toTotals, allTags);
  return { settlementType, rows, subtotal: buildHeadline(rows) };
}

/**
 * Build the two-section comparison. Each section rolls up, diffs, and sorts its
 * movers independently (via `buildComparison`) and carries its own subtotal. The
 * combined headline sums every mover across both sections, so it continues to
 * equal deferred + immediate together — the split is never duplicated up top.
 */
export function buildSectionedComparison(
  from: SettlementSplit,
  to: SettlementSplit,
  allTags: TagLean[]
): SectionedComparison {
  const deferred = buildSection("deferred", from.deferred, to.deferred, allTags);
  const immediate = buildSection("immediate", from.immediate, to.immediate, allTags);
  const headline = buildHeadline([...deferred.rows, ...immediate.rows]);

  return { deferred, immediate, headline };
}
