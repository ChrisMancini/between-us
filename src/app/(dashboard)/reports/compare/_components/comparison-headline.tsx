import { cn } from "@/lib/utils";
import type { HeadlineTotals } from "../_lib/compare-transforms";
import { bookends, deltaAmount, deltaPct, directionClass, glyph } from "../_lib/delta-format";

interface ComparisonHeadlineProps {
  fromLabel: string;
  toLabel: string;
  totals: HeadlineTotals;
}

/**
 * The one calm household headline: `Everything: $from → $to  ▲ +$Δ (+N%)`.
 * Combined (deferred + immediate) total, no per-person figures — this reads as
 * "our shared life changed by X", never as scorekeeping.
 */
export function ComparisonHeadline({ fromLabel, toLabel, totals }: ComparisonHeadlineProps) {
  const pct = deltaPct(totals.pct);
  const direction = directionClass(totals.status);
  const ends = bookends(totals);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="bg-primary/5 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Everything
        </p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-2xl font-bold tracking-tight tabular-nums">
            {ends.from}
            <span className="mx-2 text-lg font-normal text-muted-foreground">→</span>
            {ends.to}
          </p>
          <p className={cn("text-lg font-semibold tabular-nums", direction)}>
            <span className="mr-1">{glyph(totals.status)}</span>
            {deltaAmount(totals.delta)}
            {pct && <span className="ml-1.5 text-sm font-normal">({pct})</span>}
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {fromLabel} <span className="mx-0.5">→</span> {toLabel}
        </p>
      </div>
    </div>
  );
}
