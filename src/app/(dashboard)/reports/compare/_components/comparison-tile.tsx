"use client";

import { cn, formatCurrency } from "@/lib/utils";
import type { CompareRow } from "../_lib/compare-transforms";
import { deltaAmount, deltaPct, directionClass, glyph, statusLabel } from "../_lib/delta-format";
import { Dumbbell } from "./dumbbell";

interface ComparisonTileProps {
  row: CompareRow;
  maxValue: number;
}

interface DeltaDisplayProps {
  status: ComparisonTileProps["row"]["status"];
  delta: number;
  pct: number | null;
}

function DeltaDisplay({ status, delta, pct }: DeltaDisplayProps) {
  const direction = directionClass(status);
  const label = statusLabel(status);
  const secondary = label ?? (pct !== null ? deltaPct(pct) : null);

  return (
    <div className={cn("shrink-0 text-right", direction)}>
      <p className="text-sm font-semibold tabular-nums">
        <span className="mr-1">{glyph(status)}</span>
        {deltaAmount(delta)}
      </p>
      {secondary && (
        <p className="text-xs uppercase tracking-wide tabular-nums text-muted-foreground">
          {secondary}
        </p>
      )}
    </div>
  );
}

/**
 * One responsive spaced tile for a mover. Lays out differently on desktop and
 * mobile with a dumbbell showing movement from baseline to comparison.
 *
 * Desktop (≥ sm): horizontal layout — name | full-width dumbbell track | glyph+sign+$Δ
 * Mobile (< sm): stacked tile — name + $Δ on top, dumbbell + caption below
 */
export function ComparisonTile({ row, maxValue }: ComparisonTileProps) {

  return (
    <div
      className="rounded-lg border border-border/50 bg-card/50 p-4 transition-colors hover:bg-card/70"
    >
      {/* Desktop layout (hidden on mobile) */}
      <div className="hidden sm:flex gap-4 items-center">
        {/* Name + from/to values */}
        <div className="min-w-0 flex-shrink-0 w-40">
          <p className="truncate text-sm font-medium">{row.name}</p>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {row.from ? formatCurrency(row.fromTotal) : "—"}
            <span className="mx-1">→</span>
            {row.to ? formatCurrency(row.toTotal) : "—"}
          </p>
        </div>

        {/* Dumbbell track — full width */}
        <div className="flex-grow min-w-0">
          <Dumbbell
            fromValue={row.fromTotal}
            toValue={row.toTotal}
            maxValue={maxValue}
            status={row.status}
          />
        </div>

        {/* Glyph + sign + $Δ + secondary (percentage or status label) */}
        <DeltaDisplay status={row.status} delta={row.delta} pct={row.pct} />
      </div>

      {/* Mobile layout (stacked, shown on mobile) */}
      <div className="sm:hidden space-y-3">
        {/* Top: name + $Δ */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">{row.name}</p>
          <DeltaDisplay status={row.status} delta={row.delta} pct={row.pct} />
        </div>

        {/* Middle: from/to values */}
        <p className="text-xs tabular-nums text-muted-foreground">
          {row.from ? formatCurrency(row.fromTotal) : "—"}
          <span className="mx-1">→</span>
          {row.to ? formatCurrency(row.toTotal) : "—"}
        </p>

        {/* Bottom: slim dumbbell with caption */}
        <Dumbbell
          fromValue={row.fromTotal}
          toValue={row.toTotal}
          maxValue={maxValue}
          status={row.status}
          showCaption
          slim
        />
      </div>
    </div>
  );
}
