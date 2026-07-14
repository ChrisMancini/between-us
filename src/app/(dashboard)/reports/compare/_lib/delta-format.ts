// Shared delta encoding for the comparison view, promoted from the throwaway
// prototype (`compare-prototype/rows/_prototype/delta-format.ts`). This is the
// settled encoding.
//
// Glyph + sign + number is the PRIMARY encoding of direction — one partner is
// partially color blind, so meaning must never depend on hue. Color is
// reinforcement only, and deliberately NOT red/green: red/green is both the
// color-blind-unsafe axis AND reads as good/bad, which the descriptive-not-
// prescriptive guardrail forbids. Direction uses sky (increase) ↔ slate
// (decrease); amber is reserved exclusively for the partial-month badge.
import { formatCurrency } from "@/lib/utils";
import type { CompareStatus } from "./compare-transforms";

/**
 * The `$from → $to` bookend strings for a from/to pair. The absent side of a
 * new/gone pair renders as `—` (a `$0` that means "no spend that month", not
 * "spent nothing") — so the em-dash meaning survives without color. Shared by
 * the household headline and each section subtotal.
 */
export function bookends(totals: {
  fromTotal: number;
  toTotal: number;
  status: CompareStatus;
}): { from: string; to: string } {
  return {
    from: totals.fromTotal === 0 && totals.status === "new" ? "—" : formatCurrency(totals.fromTotal),
    to: totals.toTotal === 0 && totals.status === "gone" ? "—" : formatCurrency(totals.toTotal),
  };
}

/** Direction glyph. Full-width `＋`/`－`/`＝` distinguish new/gone/steady from ▲/▼. */
export function glyph(status: CompareStatus): string {
  switch (status) {
    case "new":
      return "＋"; // brand-new tag
    case "gone":
      return "－"; // fully dropped
    case "up":
      return "▲";
    case "down":
      return "▼";
    default:
      return "＝"; // exactly steady
  }
}

/** Signed dollar delta, e.g. "+$120.00" / "−$100.00" / "$0.00". Uses U+2212. */
export function deltaAmount(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${formatCurrency(Math.abs(delta))}`;
}

/** Secondary context only — never reorders. `null` when suppressed. Uses U+2212. */
export function deltaPct(pct: number | null): string | null {
  if (pct === null) return null;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(0)}%`;
}

/** The word label `new`/`gone` (so meaning survives without color); else null. */
export function statusLabel(status: CompareStatus): string | null {
  if (status === "new") return "new";
  if (status === "gone") return "gone";
  return null;
}

/** Reinforcement color for the glyph/number. Muted, non-judgmental, never red/green. */
export function directionClass(status: CompareStatus): string {
  if (status === "gone" || status === "down") return "text-slate-500 dark:text-slate-400";
  if (status === "new" || status === "up") return "text-sky-600 dark:text-sky-400";
  return "text-muted-foreground";
}

/**
 * Background gradient for dumbbell track, reinforcing direction.
 * Same color axis as `directionClass` — sky for increases/new, slate for
 * decreases/gone — so the dumbbell and the delta glyph tell the same story.
 */
export function trackGradientClass(status: CompareStatus): string {
  if (status === "gone" || status === "down") {
    return "from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800";
  }
  return "from-sky-100 to-sky-50 dark:from-sky-900 dark:to-sky-950";
}

/** Filled-dot color for the "to" side of the dumbbell, reinforcing direction. */
export function dotFillClass(status: CompareStatus): string {
  if (status === "gone" || status === "down") return "bg-slate-500 dark:bg-slate-400";
  if (status === "new" || status === "up") return "bg-sky-600 dark:bg-sky-400";
  return "bg-muted-foreground";
}
