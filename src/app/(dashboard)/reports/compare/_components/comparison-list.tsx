import type { CompareRow } from "../_lib/compare-transforms";
import { ComparisonTile } from "./comparison-tile";

interface ComparisonListProps {
  rows: CompareRow[];
}

/**
 * A gap-separated feed of responsive spaced tiles (one per mover), each showing
 * a dumbbell visualization of movement from baseline to comparison. Tiles are
 * responsive: horizontal on desktop (≥ sm), stacked on mobile (< sm).
 */
export function ComparisonList({ rows }: ComparisonListProps) {
  // Find the max value across all rows for dumbbell scaling.
  const maxValue = Math.max(
    ...rows.flatMap((r) => [r.fromTotal, r.toTotal]),
    0
  );

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <ComparisonTile key={row.path} row={row} maxValue={maxValue} />
      ))}
    </div>
  );
}
