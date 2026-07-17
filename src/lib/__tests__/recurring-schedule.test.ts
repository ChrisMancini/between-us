import {
  describeSchedule,
  nextOccurrence,
  nextOccurrenceOrNull,
  occurrencesInRange,
  schedulesEqual,
} from "@/lib/recurring-schedule";
import type {
  DayOfMonthSchedule,
  EveryNWeeksSchedule,
  LastDayOfMonthSchedule,
  NthWeekdaySchedule,
  SemiMonthlySchedule,
} from "@/lib/models/recurring-template";

const utc = (y: number, m: number, d: number, h = 0) =>
  new Date(Date.UTC(y, m - 1, d, h));

describe("occurrencesInRange (day_of_month)", () => {
  const day10: DayOfMonthSchedule = { type: "day_of_month", day: 10 };

  it("returns the day-of-month occurrence for each month in range", () => {
    const result = occurrencesInRange(day10, utc(2026, 1, 1), utc(2026, 3, 31));
    expect(result).toEqual([
      utc(2026, 1, 10),
      utc(2026, 2, 10),
      utc(2026, 3, 10),
    ]);
  });

  it("returns a single occurrence when the range spans one month", () => {
    const result = occurrencesInRange(day10, utc(2026, 5, 1), utc(2026, 5, 20));
    expect(result).toEqual([utc(2026, 5, 10)]);
  });

  it("excludes an occurrence dated before the start (enablement guard)", () => {
    // Enabled on the 10th at 2pm — that day's midnight occurrence is before it.
    const result = occurrencesInRange(day10, utc(2026, 7, 10, 14), utc(2026, 8, 31));
    expect(result).toEqual([utc(2026, 8, 10)]);
  });

  it("includes the occurrence when enabled earlier the same month", () => {
    const result = occurrencesInRange(day10, utc(2026, 7, 5, 14), utc(2026, 7, 31));
    expect(result).toEqual([utc(2026, 7, 10)]);
  });

  it("excludes an occurrence after the end", () => {
    const result = occurrencesInRange(day10, utc(2026, 7, 1), utc(2026, 7, 9));
    expect(result).toEqual([]);
  });

  it("returns empty when end precedes start", () => {
    expect(occurrencesInRange(day10, utc(2026, 7, 1), utc(2026, 6, 1))).toEqual([]);
  });

  it("clamps day 31 to the last day of shorter months", () => {
    const day31: DayOfMonthSchedule = { type: "day_of_month", day: 31 };
    const result = occurrencesInRange(day31, utc(2026, 1, 1), utc(2026, 4, 30));
    expect(result).toEqual([
      utc(2026, 1, 31),
      utc(2026, 2, 28), // 2026 is not a leap year
      utc(2026, 3, 31),
      utc(2026, 4, 30),
    ]);
  });

  it("clamps day 31 to Feb 29 in a leap year", () => {
    const day31: DayOfMonthSchedule = { type: "day_of_month", day: 31 };
    const result = occurrencesInRange(day31, utc(2028, 2, 1), utc(2028, 2, 29));
    expect(result).toEqual([utc(2028, 2, 29)]);
  });

  it("includes both endpoints when they fall on occurrences", () => {
    const result = occurrencesInRange(day10, utc(2026, 1, 10), utc(2026, 2, 10));
    expect(result).toEqual([utc(2026, 1, 10), utc(2026, 2, 10)]);
  });
});

describe("nextOccurrence (day_of_month)", () => {
  it("returns the next occurrence strictly after the given moment", () => {
    const day10: DayOfMonthSchedule = { type: "day_of_month", day: 10 };
    expect(nextOccurrence(day10, utc(2026, 7, 5))).toEqual(utc(2026, 7, 10));
  });

  it("rolls to next month when the occurrence has already passed", () => {
    const day10: DayOfMonthSchedule = { type: "day_of_month", day: 10 };
    expect(nextOccurrence(day10, utc(2026, 7, 10))).toEqual(utc(2026, 8, 10));
  });

  it("clamps to the last day of the month", () => {
    const day31: DayOfMonthSchedule = { type: "day_of_month", day: 31 };
    expect(nextOccurrence(day31, utc(2026, 2, 1))).toEqual(utc(2026, 2, 28));
  });
});

describe("occurrencesInRange (last_day_of_month)", () => {
  const lastDay: LastDayOfMonthSchedule = { type: "last_day_of_month" };

  it("returns the real last day of each month", () => {
    const result = occurrencesInRange(lastDay, utc(2026, 1, 1), utc(2026, 4, 30));
    expect(result).toEqual([
      utc(2026, 1, 31),
      utc(2026, 2, 28), // not a leap year
      utc(2026, 3, 31),
      utc(2026, 4, 30),
    ]);
  });

  it("resolves Feb 29 in a leap year", () => {
    const result = occurrencesInRange(lastDay, utc(2028, 2, 1), utc(2028, 2, 29));
    expect(result).toEqual([utc(2028, 2, 29)]);
  });
});

describe("occurrencesInRange (nth_weekday)", () => {
  it("resolves the last Friday of each month", () => {
    const lastFri: NthWeekdaySchedule = {
      type: "nth_weekday",
      ordinal: "last",
      weekday: 5,
    };
    const result = occurrencesInRange(lastFri, utc(2026, 1, 1), utc(2026, 3, 31));
    expect(result).toEqual([
      utc(2026, 1, 30),
      utc(2026, 2, 27),
      utc(2026, 3, 27),
    ]);
  });

  it("resolves the first Monday of each month", () => {
    const firstMon: NthWeekdaySchedule = {
      type: "nth_weekday",
      ordinal: 1,
      weekday: 1,
    };
    const result = occurrencesInRange(firstMon, utc(2026, 7, 1), utc(2026, 8, 31));
    expect(result).toEqual([utc(2026, 7, 6), utc(2026, 8, 3)]);
  });

  it("resolves the third Wednesday of a month", () => {
    const thirdWed: NthWeekdaySchedule = {
      type: "nth_weekday",
      ordinal: 3,
      weekday: 3,
    };
    expect(nextOccurrence(thirdWed, utc(2026, 7, 1))).toEqual(utc(2026, 7, 15));
  });
});

describe("occurrencesInRange (semi_monthly)", () => {
  it("returns both fixed days each month, in order", () => {
    const midAndEnd: SemiMonthlySchedule = {
      type: "semi_monthly",
      days: [15, "last"],
    };
    const result = occurrencesInRange(midAndEnd, utc(2026, 1, 1), utc(2026, 2, 28));
    expect(result).toEqual([
      utc(2026, 1, 15),
      utc(2026, 1, 31),
      utc(2026, 2, 15),
      utc(2026, 2, 28),
    ]);
  });

  it("clamps a numeric day and de-duplicates a collision within a month", () => {
    // 30 and "last" both resolve to Feb 28 — the occurrence must appear once.
    const collide: SemiMonthlySchedule = {
      type: "semi_monthly",
      days: [30, "last"],
    };
    const result = occurrencesInRange(collide, utc(2026, 2, 1), utc(2026, 2, 28));
    expect(result).toEqual([utc(2026, 2, 28)]);
  });
});

describe("occurrencesInRange (every_n_weeks)", () => {
  const biweekly: EveryNWeeksSchedule = {
    type: "every_n_weeks",
    interval: 2,
    anchorDate: "2026-07-10", // a Friday
  };

  it("fires every two weeks anchored to the start date, across month boundaries", () => {
    const result = occurrencesInRange(biweekly, utc(2026, 7, 1), utc(2026, 9, 10));
    expect(result).toEqual([
      utc(2026, 7, 10),
      utc(2026, 7, 24),
      utc(2026, 8, 7),
      utc(2026, 8, 21),
      utc(2026, 9, 4),
    ]);
  });

  it("never returns an occurrence before the anchor date", () => {
    const result = occurrencesInRange(biweekly, utc(2026, 6, 1), utc(2026, 7, 23));
    expect(result).toEqual([utc(2026, 7, 10)]);
  });

  it("fast-forwards correctly when the range starts long after the anchor", () => {
    const result = occurrencesInRange(biweekly, utc(2027, 1, 1), utc(2027, 1, 31));
    // Anchor 2026-07-10 + multiples of 14 days landing in Jan 2027 (both Fridays).
    expect(result).toEqual([utc(2027, 1, 8), utc(2027, 1, 22)]);
  });

  it("handles a weekly cadence (interval 1)", () => {
    const weekly: EveryNWeeksSchedule = {
      type: "every_n_weeks",
      interval: 1,
      anchorDate: "2026-07-10",
    };
    expect(nextOccurrence(weekly, utc(2026, 7, 12))).toEqual(utc(2026, 7, 17));
  });

  it("finds an anchor far in the future (beyond the initial horizon)", () => {
    // Anchor is ~5 months out — well past two intervals — but is the first occurrence.
    const future: EveryNWeeksSchedule = {
      type: "every_n_weeks",
      interval: 2,
      anchorDate: "2026-12-04",
    };
    expect(nextOccurrence(future, utc(2026, 7, 1))).toEqual(utc(2026, 12, 4));
  });
});

describe("weekend adjustment (next_weekday)", () => {
  it("rolls a Saturday day-of-month occurrence to Monday", () => {
    // Jan 10 2026 is a Saturday.
    const day10: DayOfMonthSchedule = {
      type: "day_of_month",
      day: 10,
      weekendAdjustment: "next_weekday",
    };
    const result = occurrencesInRange(day10, utc(2026, 1, 1), utc(2026, 1, 31));
    expect(result).toEqual([utc(2026, 1, 12)]); // Monday
  });

  it("rolls a Sunday semi-monthly occurrence to Monday", () => {
    // Feb 15 2026 is a Sunday.
    const semi: SemiMonthlySchedule = {
      type: "semi_monthly",
      days: [15, "last"],
      weekendAdjustment: "next_weekday",
    };
    // Range starts Feb 10 to exclude Jan's last day (Sat 31 → Mon Feb 2).
    const result = occurrencesInRange(semi, utc(2026, 2, 10), utc(2026, 2, 20));
    expect(result).toEqual([utc(2026, 2, 16)]); // Sun 15 → Mon 16
  });

  it("rolls a last-day Saturday forward, even across a month boundary", () => {
    // Jan 31 2026 is a Saturday → rolls to Mon Feb 2.
    const lastDay: LastDayOfMonthSchedule = {
      type: "last_day_of_month",
      weekendAdjustment: "next_weekday",
    };
    const result = occurrencesInRange(lastDay, utc(2026, 1, 1), utc(2026, 2, 2));
    expect(result).toEqual([utc(2026, 2, 2)]);
  });

  it("leaves a weekday occurrence untouched", () => {
    // Feb 10 2026 is a Tuesday.
    const day10: DayOfMonthSchedule = {
      type: "day_of_month",
      day: 10,
      weekendAdjustment: "next_weekday",
    };
    const result = occurrencesInRange(day10, utc(2026, 2, 1), utc(2026, 2, 28));
    expect(result).toEqual([utc(2026, 2, 10)]);
  });

  it("is a no-op when adjustment is 'none'", () => {
    const day10: DayOfMonthSchedule = {
      type: "day_of_month",
      day: 10,
      weekendAdjustment: "none",
    };
    const result = occurrencesInRange(day10, utc(2026, 1, 1), utc(2026, 1, 31));
    expect(result).toEqual([utc(2026, 1, 10)]); // Saturday, untouched
  });
});

describe("malformed schedules degrade gracefully", () => {
  // A legacy/partial document, e.g. { type: "every_n_weeks" } with no anchor.
  const broken = { type: "every_n_weeks" } as unknown as EveryNWeeksSchedule;

  it("returns no occurrences instead of throwing", () => {
    expect(occurrencesInRange(broken, utc(2026, 1, 1), utc(2026, 12, 31))).toEqual(
      []
    );
  });

  it("nextOccurrenceOrNull yields null rather than throwing", () => {
    expect(nextOccurrenceOrNull(broken, utc(2026, 1, 1))).toBeNull();
  });

  it("describeSchedule returns a safe fallback", () => {
    expect(describeSchedule(broken)).toBe("Schedule is incomplete");
  });
});

describe("describeSchedule", () => {
  it("describes a day-of-month schedule", () => {
    expect(describeSchedule({ type: "day_of_month", day: 10 })).toBe(
      "Applies on the 10th of each month"
    );
    expect(describeSchedule({ type: "day_of_month", day: 1 })).toBe(
      "Applies on the 1st of each month"
    );
    expect(describeSchedule({ type: "day_of_month", day: 23 })).toBe(
      "Applies on the 23rd of each month"
    );
  });

  it("notes weekend roll-forward when enabled", () => {
    expect(
      describeSchedule({
        type: "day_of_month",
        day: 1,
        weekendAdjustment: "next_weekday",
      })
    ).toBe(
      "Applies on the 1st of each month (rolled to the next weekday if it lands on a weekend)"
    );
  });

  it("describes last day of month", () => {
    expect(describeSchedule({ type: "last_day_of_month" })).toBe(
      "Applies on the last day of each month"
    );
  });

  it("describes an nth-weekday schedule", () => {
    expect(
      describeSchedule({ type: "nth_weekday", ordinal: "last", weekday: 5 })
    ).toBe("Applies on the last Friday of each month");
    expect(
      describeSchedule({ type: "nth_weekday", ordinal: 1, weekday: 1 })
    ).toBe("Applies on the first Monday of each month");
  });

  it("describes a semi-monthly schedule", () => {
    expect(
      describeSchedule({ type: "semi_monthly", days: [15, "last"] })
    ).toBe("Applies on the 15th and the last day of each month");
  });

  it("describes an every-n-weeks schedule", () => {
    expect(
      describeSchedule({
        type: "every_n_weeks",
        interval: 2,
        anchorDate: "2026-07-10",
      })
    ).toBe("Applies every 2 weeks on Fridays, starting Jul 10, 2026");
    expect(
      describeSchedule({
        type: "every_n_weeks",
        interval: 1,
        anchorDate: "2026-07-10",
      })
    ).toBe("Applies every week on Fridays, starting Jul 10, 2026");
  });
});

describe("schedulesEqual", () => {
  it("treats two nulls as equal and null vs a schedule as different", () => {
    expect(schedulesEqual(null, null)).toBe(true);
    expect(schedulesEqual(null, { type: "day_of_month", day: 10 })).toBe(false);
    expect(schedulesEqual({ type: "day_of_month", day: 10 }, null)).toBe(false);
  });

  it("is false across different families", () => {
    expect(
      schedulesEqual(
        { type: "day_of_month", day: 10 },
        { type: "last_day_of_month" }
      )
    ).toBe(false);
  });

  it("compares only the fields a family uses", () => {
    expect(
      schedulesEqual(
        { type: "day_of_month", day: 10 },
        { type: "day_of_month", day: 10 }
      )
    ).toBe(true);
    expect(
      schedulesEqual(
        { type: "day_of_month", day: 10 },
        { type: "day_of_month", day: 15 }
      )
    ).toBe(false);
  });

  it("detects nth-weekday, semi-monthly, and every-n-weeks param changes", () => {
    expect(
      schedulesEqual(
        { type: "nth_weekday", ordinal: "last", weekday: 5 },
        { type: "nth_weekday", ordinal: "last", weekday: 5 }
      )
    ).toBe(true);
    expect(
      schedulesEqual(
        { type: "nth_weekday", ordinal: "last", weekday: 5 },
        { type: "nth_weekday", ordinal: 1, weekday: 5 }
      )
    ).toBe(false);
    expect(
      schedulesEqual(
        { type: "semi_monthly", days: [15, "last"] },
        { type: "semi_monthly", days: [15, "last"] }
      )
    ).toBe(true);
    expect(
      schedulesEqual(
        { type: "semi_monthly", days: [15, "last"] },
        { type: "semi_monthly", days: [1, "last"] }
      )
    ).toBe(false);
    expect(
      schedulesEqual(
        { type: "every_n_weeks", interval: 2, anchorDate: "2026-07-10" },
        { type: "every_n_weeks", interval: 2, anchorDate: "2026-07-24" }
      )
    ).toBe(false);
  });

  it("normalizes an absent weekendAdjustment to \"none\"", () => {
    expect(
      schedulesEqual(
        { type: "day_of_month", day: 10 },
        { type: "day_of_month", day: 10, weekendAdjustment: "none" }
      )
    ).toBe(true);
    expect(
      schedulesEqual(
        { type: "day_of_month", day: 10 },
        { type: "day_of_month", day: 10, weekendAdjustment: "next_weekday" }
      )
    ).toBe(false);
  });

  it("ignores null siblings a stored document carries for unused fields", () => {
    // Mongoose lean docs include every union field; the unused ones are null.
    const stored = {
      type: "day_of_month",
      day: 10,
      ordinal: null,
      weekday: null,
      days: [],
      interval: null,
      anchorDate: null,
      weekendAdjustment: "none",
    } as unknown as import("@/lib/models/recurring-template").RecurringSchedule;
    expect(schedulesEqual(stored, { type: "day_of_month", day: 10 })).toBe(true);
  });
});
