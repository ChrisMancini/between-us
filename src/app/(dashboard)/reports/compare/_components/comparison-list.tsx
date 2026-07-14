import { cn, formatCurrency } from "@/lib/utils";
import type { CompareRow } from "../_lib/compare-transforms";
import { deltaAmount, deltaPct, directionClass, glyph, statusLabel } from "../_lib/delta-format";

interface ComparisonListProps {
  rows: CompareRow[];
}

/**
 * A plain flat list of per-parent-tag movers, biggest absolute change first.
 * The tile/dumbbell layout, section split, and drill-down arrive in later
 * tickets; this tracer bullet keeps the row deliberately simple.
 */
export function ComparisonList({ rows }: ComparisonListProps) {
  return (
    <div className="divide-y rounded-xl border bg-card">
      {rows.map((row) => (
        <ComparisonRow key={row.path} row={row} />
      ))}
    </div>
  );
}

function ComparisonRow({ row }: { row: CompareRow }) {
  const label = statusLabel(row.status);
  const pct = deltaPct(row.pct);
  const secondary = label ?? pct;
  const direction = directionClass(row.status);

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{row.name}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {row.from ? formatCurrency(row.fromTotal) : "—"}
          <span className="mx-1">→</span>
          {row.to ? formatCurrency(row.toTotal) : "—"}
        </p>
      </div>
      <div className={cn("shrink-0 text-right", direction)}>
        <p className="text-sm font-semibold tabular-nums">
          <span className="mr-1">{glyph(row.status)}</span>
          {deltaAmount(row.delta)}
        </p>
        {secondary && (
          <p className="text-xs uppercase tracking-wide tabular-nums text-muted-foreground">
            {secondary}
          </p>
        )}
      </div>
    </div>
  );
}
