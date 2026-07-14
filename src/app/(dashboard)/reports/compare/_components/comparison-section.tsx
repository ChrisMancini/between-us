import { cn } from "@/lib/utils";
import type { SettlementSection } from "../_lib/compare-transforms";
import { bookends, deltaAmount, deltaPct, directionClass, glyph } from "../_lib/delta-format";
import { ComparisonList } from "./comparison-list";

// A light header line + one-line blurb per settlement type (#50). Copy stays
// warm and factual, never a verdict — this is a mirror on shared life.
const SECTION_META: Record<
  SettlementSection["settlementType"],
  { title: string; blurb: string }
> = {
  deferred: {
    title: "Deferred",
    blurb: "Spend that accumulates into the monthly settlement.",
  },
  immediate: {
    title: "Immediate",
    blurb: "Spend already settled at the time — like the mortgage.",
  },
};

interface ComparisonSectionProps {
  section: SettlementSection;
}

/**
 * One settlement-type section: a light header (title + blurb + its own subtotal
 * Δ in `from → to  glyph+$Δ` form) above that section's movers. Its movers are
 * already rolled up and sorted independently by |Δ| in the transform.
 */
export function ComparisonSection({ section }: ComparisonSectionProps) {
  const meta = SECTION_META[section.settlementType];
  const { subtotal } = section;
  const pct = deltaPct(subtotal.pct);
  const direction = directionClass(subtotal.status);
  const ends = bookends(subtotal);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{meta.title}</h2>
          <p className="text-xs text-muted-foreground">{meta.blurb}</p>
        </div>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="text-xs text-muted-foreground">
            {ends.from}
            <span className="mx-1">→</span>
            {ends.to}
          </span>
          <span className={cn("text-sm font-semibold", direction)}>
            <span className="mr-1">{glyph(subtotal.status)}</span>
            {deltaAmount(subtotal.delta)}
            {pct && <span className="ml-1 text-xs font-normal">({pct})</span>}
          </span>
        </div>
      </div>
      <ComparisonList rows={section.rows} />
    </section>
  );
}
