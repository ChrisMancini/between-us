"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { CompareRow } from "../_lib/compare-transforms";
import { ComparisonTile } from "./comparison-tile";

interface ComparisonListProps {
  brightRows: CompareRow[];
  dimmedRows: CompareRow[];
}

/**
 * Bright movers in a gap-separated feed of responsive spaced tiles, with
 * dimmed movers tucked behind a per-section collapsible expander.
 */
export function ComparisonList({ brightRows, dimmedRows }: ComparisonListProps) {
  const [showDimmed, setShowDimmed] = useState(false);

  // Find the max value across all rows (bright + dimmed) for dumbbell scaling.
  const allRows = [...brightRows, ...dimmedRows];
  const maxValue = Math.max(
    ...allRows.flatMap((r) => [r.fromTotal, r.toTotal]),
    0
  );

  return (
    <div className="space-y-2">
      {brightRows.map((row) => (
        <ComparisonTile key={row.path} row={row} maxValue={maxValue} />
      ))}

      {dimmedRows.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowDimmed(!showDimmed)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${showDimmed ? "rotate-90" : ""}`}
            />
            {showDimmed ? "Hide" : "Show"} {dimmedRows.length} small change{dimmedRows.length !== 1 ? "s" : ""}
          </button>

          {showDimmed && (
            <div className="space-y-2 opacity-60">
              {dimmedRows.map((row) => (
                <ComparisonTile key={row.path} row={row} maxValue={maxValue} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
