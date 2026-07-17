import type {
  DayOfMonthSchedule,
  EveryNWeeksSchedule,
  NthWeekdaySchedule,
  RecurringSchedule,
  SemiMonthlyDay,
  SemiMonthlySchedule,
  WeekOrdinal,
  Weekday,
  WeekendAdjustment,
} from "./models/recurring-template";

/**
 * Pure occurrence math for recurring schedules (ADR-0018, decision 2).
 *
 * All dates are treated in UTC and occurrences are emitted at UTC midnight, matching
 * how expense dates are stored. This module is the single source of truth for both
 * the runner and the UI's next-run preview, and covers all five schedule families
 * plus weekend-only business-day adjustment.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Number of days in the given UTC month (monthIndex0 is 0–11). */
function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/** The clamped day-of-month date (UTC midnight) for a given month. */
function dayOfMonthDate(year: number, monthIndex0: number, day: number): Date {
  const clamped = Math.min(day, daysInMonth(year, monthIndex0));
  return new Date(Date.UTC(year, monthIndex0, clamped));
}

/** The last calendar day of a given month (UTC midnight). */
function lastDayDate(year: number, monthIndex0: number): Date {
  return new Date(Date.UTC(year, monthIndex0, daysInMonth(year, monthIndex0)));
}

/** The nth (or last) occurrence of `weekday` in a given month (UTC midnight). */
function nthWeekdayDate(
  year: number,
  monthIndex0: number,
  ordinal: WeekOrdinal,
  weekday: Weekday
): Date {
  if (ordinal === "last") {
    const last = lastDayDate(year, monthIndex0);
    const diff = (last.getUTCDay() - weekday + 7) % 7;
    return new Date(Date.UTC(year, monthIndex0, last.getUTCDate() - diff));
  }
  const first = new Date(Date.UTC(year, monthIndex0, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  // For ordinals 1–4 this never exceeds day 28, so it always lands in-month.
  return new Date(Date.UTC(year, monthIndex0, 1 + offset + (ordinal - 1) * 7));
}

/** Resolve one semi-monthly day (a clamped day-of-month or the month's last day). */
function semiMonthlyDate(
  year: number,
  monthIndex0: number,
  day: SemiMonthlyDay
): Date {
  return day === "last"
    ? lastDayDate(year, monthIndex0)
    : dayOfMonthDate(year, monthIndex0, day);
}

/**
 * Apply weekend roll-forward: a Saturday moves to the following Monday (+2 days),
 * a Sunday to Monday (+1 day). Absent or "none" leaves the date untouched. The roll
 * is applied to the computed date, so it may cross a month boundary (ADR-0018, 2).
 */
function applyWeekendAdjustment(
  date: Date,
  adjustment: WeekendAdjustment | undefined
): Date {
  if (adjustment !== "next_weekday") return date;
  const dow = date.getUTCDay();
  if (dow === 6) return new Date(date.getTime() + 2 * DAY_MS); // Sat → Mon
  if (dow === 0) return new Date(date.getTime() + 1 * DAY_MS); // Sun → Mon
  return date;
}

/** Combined year·12 + month index, for iterating months as a single counter. */
function monthIndex(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/**
 * The base (pre-adjustment) occurrence date(s) a month-anchored schedule places in
 * the given month. Returns an empty array for the interval-anchored `every_n_weeks`
 * family, which is handled separately.
 */
function monthlyBaseDates(
  schedule: RecurringSchedule,
  year: number,
  monthIndex0: number
): Date[] {
  switch (schedule.type) {
    case "day_of_month":
      return [dayOfMonthDate(year, monthIndex0, schedule.day)];
    case "last_day_of_month":
      return [lastDayDate(year, monthIndex0)];
    case "nth_weekday":
      return [
        nthWeekdayDate(year, monthIndex0, schedule.ordinal, schedule.weekday),
      ];
    case "semi_monthly":
      return [
        semiMonthlyDate(year, monthIndex0, schedule.days[0]),
        semiMonthlyDate(year, monthIndex0, schedule.days[1]),
      ];
    case "every_n_weeks":
      // Interval-anchored, not month-anchored — handled by everyNWeeksInRange.
      return [];
  }
}

/** Occurrences of a month-anchored schedule within [start, end]. */
function monthlyOccurrencesInRange(
  schedule: RecurringSchedule,
  start: Date,
  end: Date
): Date[] {
  const seen = new Set<number>();
  const result: Date[] = [];
  // Widen by a month on each side so a weekend roll-forward from a neighbouring
  // month is caught, then filter strictly to the requested window.
  const endIndex = monthIndex(end) + 1;
  for (let index = monthIndex(start) - 1; index <= endIndex; index += 1) {
    const year = Math.floor(index / 12);
    const month0 = index % 12;
    for (const base of monthlyBaseDates(schedule, year, month0)) {
      const occ = applyWeekendAdjustment(base, schedule.weekendAdjustment);
      const t = occ.getTime();
      if (t >= start.getTime() && t <= end.getTime() && !seen.has(t)) {
        seen.add(t);
        result.push(occ);
      }
    }
  }
  result.sort((a, b) => a.getTime() - b.getTime());
  return result;
}

/** Parse an anchor date stored as "YYYY-MM-DD" into a UTC-midnight Date. */
function parseAnchorDate(anchorDate: string): Date {
  const [year, month, day] = anchorDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Occurrences of an every-N-weeks schedule within [start, end]. */
function everyNWeeksInRange(
  anchorDate: string,
  interval: number,
  weekendAdjustment: WeekendAdjustment | undefined,
  start: Date,
  end: Date
): Date[] {
  const anchor = parseAnchorDate(anchorDate);
  const stepMs = interval * 7 * DAY_MS;

  // Fast-forward to the first step at/after `start`, never before the anchor. The
  // `- 1` step of slack lets a weekend roll-forward pull an earlier base into range.
  let k = 0;
  if (start.getTime() > anchor.getTime()) {
    k = Math.max(0, Math.floor((start.getTime() - anchor.getTime()) / stepMs) - 1);
  }

  const result: Date[] = [];
  for (let guard = 0; guard < 10000; guard += 1, k += 1) {
    const base = new Date(anchor.getTime() + k * stepMs);
    const occ = applyWeekendAdjustment(base, weekendAdjustment);
    if (occ.getTime() > end.getTime()) break;
    if (occ.getTime() >= start.getTime()) result.push(occ);
  }
  return result;
}

function isValidDay(day: unknown): boolean {
  return typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 31;
}

function isValidSemiDay(day: unknown): boolean {
  return day === "last" || isValidDay(day);
}

/**
 * Whether a stored schedule has the fields its family needs. Guards the pure
 * functions below against malformed or legacy documents so one bad schedule can
 * never crash the whole `/recurring` page or the scheduler run — it is simply
 * treated as producing no occurrences.
 */
export function isValidSchedule(schedule: RecurringSchedule): boolean {
  switch (schedule.type) {
    case "day_of_month":
      return isValidDay(schedule.day);
    case "last_day_of_month":
      return true;
    case "nth_weekday":
      return (
        (schedule.ordinal === "last" ||
          (typeof schedule.ordinal === "number" &&
            schedule.ordinal >= 1 &&
            schedule.ordinal <= 4)) &&
        typeof schedule.weekday === "number" &&
        schedule.weekday >= 0 &&
        schedule.weekday <= 6
      );
    case "semi_monthly":
      return (
        Array.isArray(schedule.days) &&
        schedule.days.length === 2 &&
        schedule.days.every(isValidSemiDay)
      );
    case "every_n_weeks":
      return (
        typeof schedule.interval === "number" &&
        Number.isInteger(schedule.interval) &&
        schedule.interval >= 1 &&
        typeof schedule.anchorDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(schedule.anchorDate)
      );
  }
}

/**
 * Structural equality of two schedules, comparing only the fields each family
 * actually uses (plus weekend adjustment, where absent ⇒ "none"). Robust to stored
 * Mongoose documents that carry null siblings for a family's unused fields.
 *
 * Used on edit to detect a schedule change so catch-up can be re-anchored to the
 * change moment: switching family or params must not backfill the new schedule's
 * history into open months (ADR-0018, decision 2a; story 12, #73).
 */
export function schedulesEqual(
  a: RecurringSchedule | null,
  b: RecurringSchedule | null
): boolean {
  if (a === null || b === null) return a === b;
  if (a.type !== b.type) return false;
  if ((a.weekendAdjustment ?? "none") !== (b.weekendAdjustment ?? "none")) {
    return false;
  }
  switch (a.type) {
    case "day_of_month":
      return a.day === (b as DayOfMonthSchedule).day;
    case "last_day_of_month":
      return true;
    case "nth_weekday": {
      const nb = b as NthWeekdaySchedule;
      return a.ordinal === nb.ordinal && a.weekday === nb.weekday;
    }
    case "semi_monthly": {
      const sb = b as SemiMonthlySchedule;
      return a.days[0] === sb.days[0] && a.days[1] === sb.days[1];
    }
    case "every_n_weeks": {
      const eb = b as EveryNWeeksSchedule;
      return a.interval === eb.interval && a.anchorDate === eb.anchorDate;
    }
  }
}

/**
 * Every occurrence of `schedule` within the inclusive range [start, end], in
 * chronological order. Returns an empty array when `end` precedes `start` or when
 * the schedule is malformed (see {@link isValidSchedule}).
 */
export function occurrencesInRange(
  schedule: RecurringSchedule,
  start: Date,
  end: Date
): Date[] {
  if (end.getTime() < start.getTime()) return [];
  if (!isValidSchedule(schedule)) return [];
  if (schedule.type === "every_n_weeks") {
    return everyNWeeksInRange(
      schedule.anchorDate,
      schedule.interval,
      schedule.weekendAdjustment,
      start,
      end
    );
  }
  return monthlyOccurrencesInRange(schedule, start, end);
}

/**
 * The first occurrence strictly after `after`, or null if none can be found. Never
 * throws — the horizon expands until an occurrence is found (an every-N-weeks anchor
 * may sit arbitrarily far in the future) or the search is exhausted.
 */
export function nextOccurrenceOrNull(
  schedule: RecurringSchedule,
  after: Date
): Date | null {
  const from = new Date(after.getTime() + 1);
  // Start comfortably larger than the longest gap between occurrences (~13 months
  // for month-anchored families, two intervals for every-N-weeks), then widen for a
  // distant anchor.
  let horizonDays =
    schedule.type === "every_n_weeks" ? schedule.interval * 7 * 2 + 14 : 400;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const end = new Date(from.getTime() + horizonDays * DAY_MS);
    const occ = occurrencesInRange(schedule, from, end);
    if (occ.length > 0) return occ[0];
    horizonDays *= 4;
  }
  return null;
}

/** The first occurrence strictly after `after`. Throws if none can be found. */
export function nextOccurrence(schedule: RecurringSchedule, after: Date): Date {
  const occ = nextOccurrenceOrNull(schedule, after);
  if (occ === null) {
    throw new Error(
      `No occurrence found within horizon for schedule "${schedule.type}"`
    );
  }
  return occ;
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const ORDINAL_WORDS: Record<string, string> = {
  "1": "first",
  "2": "second",
  "3": "third",
  "4": "fourth",
  last: "last",
};

/** Format a day number with its ordinal suffix: 1 → "1st", 22 → "22nd". */
function ordinalDay(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** A semi-monthly day rendered for prose: `15 → "15th"`, `"last" → "last day"`. */
function semiMonthlyLabel(day: SemiMonthlyDay): string {
  return day === "last" ? "last day" : ordinalDay(day);
}

const WEEKEND_NOTE = " (rolled to the next weekday if it lands on a weekend)";

/**
 * A plain-English summary of a schedule for the config preview and template card
 * (ADR-0018, decision 5). The weekend note is appended only for date-anchored
 * families, where a weekend can actually be hit.
 */
export function describeSchedule(schedule: RecurringSchedule): string {
  if (!isValidSchedule(schedule)) return "Schedule is incomplete";

  const weekendNote =
    schedule.weekendAdjustment === "next_weekday" ? WEEKEND_NOTE : "";

  switch (schedule.type) {
    case "day_of_month":
      return `Applies on the ${ordinalDay(schedule.day)} of each month${weekendNote}`;
    case "last_day_of_month":
      return `Applies on the last day of each month${weekendNote}`;
    case "nth_weekday":
      return `Applies on the ${ORDINAL_WORDS[String(schedule.ordinal)]} ${WEEKDAY_NAMES[schedule.weekday]} of each month`;
    case "semi_monthly":
      return `Applies on the ${semiMonthlyLabel(schedule.days[0])} and the ${semiMonthlyLabel(schedule.days[1])} of each month${weekendNote}`;
    case "every_n_weeks": {
      const anchor = parseAnchorDate(schedule.anchorDate);
      const weekday = WEEKDAY_NAMES[anchor.getUTCDay()];
      const cadence =
        schedule.interval === 1 ? "every week" : `every ${schedule.interval} weeks`;
      const startStr = anchor.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
      return `Applies ${cadence} on ${weekday}s, starting ${startStr}${weekendNote}`;
    }
  }
}
