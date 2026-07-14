"use client";

import { cn } from "@/lib/utils";
import type { CompareStatus } from "../_lib/compare-transforms";
import { dotFillClass } from "../_lib/delta-format";

interface DumbbellProps {
  fromValue: number;
  toValue: number;
  maxValue: number;
  status: CompareStatus;
  /** On mobile, shows as a caption like "○ from → ● to" */
  showCaption?: boolean;
  /** Slim variant for drill-down rows */
  slim?: boolean;
}

/**
 * A dumbbell track showing the movement from baseline (`from` → hollow dot) to
 * comparison (`to` → filled dot). The track scales to the relevant max so movement
 * is legible. Color reinforces direction (sky = up/new, slate = down/gone) but
 * the primary encoding is the glyph + sign + dollar amount elsewhere on the tile.
 *
 * This is a visual reinforcement, not the primary signal — meaning never depends
 * on color alone (for color-blind accessibility).
 */
export function Dumbbell({ fromValue, toValue, maxValue, status, showCaption, slim }: DumbbellProps) {
  // Clamp to non-negative and ensure a minimum maxValue for track visibility.
  const from = Math.max(0, fromValue);
  const to = Math.max(0, toValue);
  const max = Math.max(maxValue, from, to, 1); // Ensure we have a valid scale.

  // Track is full width; dots are positioned as a fraction of the scale.
  const fromPercent = (from / max) * 100;
  const toPercent = (to / max) * 100;
  const lo = Math.min(fromPercent, toPercent);
  const hi = Math.max(fromPercent, toPercent);

  return (
    <div className={cn("space-y-1", slim && "space-y-0.5")}>
      {/* Track container */}
      <div className={cn("relative w-full", slim ? "h-4" : "h-5")}>
        {/* Baseline track (thin, muted) */}
        <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-border/60" />

        {/* Active movement segment between from and to dots (thicker, colored) */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 rounded-full",
            slim ? "h-0.5" : "h-1",
            status === "gone" || status === "down"
              ? "bg-slate-400/50 dark:bg-slate-500/50"
              : "bg-sky-500/50 dark:bg-sky-600/50"
          )}
          style={{ left: `${lo}%`, width: `${hi - lo}%` }}
        />

        {/* From dot (hollow) */}
        <div
          className={cn(
            "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted-foreground bg-background",
            slim ? "h-2 w-2" : "h-2.5 w-2.5"
          )}
          style={{ left: `${fromPercent}%` }}
        />

        {/* To dot (filled, larger) */}
        <div
          className={cn(
            "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background",
            dotFillClass(status),
            slim ? "h-2.5 w-2.5" : "h-3 w-3"
          )}
          style={{ left: `${toPercent}%` }}
        />
      </div>

      {/* Caption: "○ from → ● to" on mobile */}
      {showCaption && (
        <p className="text-xs text-muted-foreground tabular-nums">
          <span>○ from</span>
          <span className="mx-1">→</span>
          <span>● to</span>
        </p>
      )}
    </div>
  );
}
