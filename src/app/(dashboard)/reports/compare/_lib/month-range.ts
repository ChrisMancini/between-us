// Month selection helpers for the comparison view's `?from=YYYY-MM&to=YYYY-MM`
// URL contract (spec #48, tracer bullet #49). Pure, apart from `currentYM`,
// which reads the clock. The interactive selection strip (#51) builds on these.

export interface YM {
  year: number;
  month: number; // 1-12
}

/** The current calendar month. */
export function currentYM(): YM {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Add (or subtract) whole months, rolling across year boundaries. */
export function addMonths({ year, month }: YM, delta: number): YM {
  const zeroBased = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(zeroBased / 12),
    month: (((zeroBased % 12) + 12) % 12) + 1,
  };
}

/** A comparable integer for a month, for ordering / future checks. */
function monthIndex({ year, month }: YM): number {
  return year * 12 + (month - 1);
}

/** Serialize to the `YYYY-MM` URL param form (month zero-padded). */
export function ymToParam({ year, month }: YM): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Parse a `YYYY-MM` param; returns null for missing or malformed input. */
export function parseYM(value: string | undefined): YM | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{1,2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** Clamp a month to at most the current month (future months can't have data). */
export function clampToPast(ym: YM): YM {
  const current = currentYM();
  return monthIndex(ym) > monthIndex(current) ? current : ym;
}
