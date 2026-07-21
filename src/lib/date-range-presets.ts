import {
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import type { DateRange } from "react-day-picker";

export interface DateRangePreset {
  label: string;
  range: DateRange;
}

/**
 * The quick-select ranges offered alongside the calendar in the date-range
 * picker. Bounds are snapped to start-/end-of-day in the caller's local time so
 * the window is inclusive on both ends. `now` is injected (rather than read via
 * `new Date()`) to keep the function pure and deterministically testable.
 *
 * "All time" is intentionally absent — it clears the range rather than setting
 * one, so the picker models it as a distinct action, not a preset range.
 */
export function getDateRangePresets(now: Date): DateRangePreset[] {
  const today = endOfDay(now);
  const lastMonthAnchor = subMonths(now, 1);

  return [
    {
      label: "Last 7 days",
      range: { from: startOfDay(subDays(now, 6)), to: today },
    },
    {
      label: "Last 30 days",
      range: { from: startOfDay(subDays(now, 29)), to: today },
    },
    {
      label: "This month",
      range: { from: startOfMonth(now), to: today },
    },
    {
      label: "Last month",
      range: {
        from: startOfMonth(lastMonthAnchor),
        to: endOfMonth(lastMonthAnchor),
      },
    },
  ];
}
