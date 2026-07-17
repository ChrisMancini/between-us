import {
  buildSchedulePayload,
  scheduleToFormDefaults,
  formSchema,
  type ScheduleFormFields,
} from "../template-form-schema";
import type { RecurringSchedule } from "@/lib/models/recurring-template";

const enabled = (fields: ScheduleFormFields) => ({
  autoApplyEnabled: true,
  ...fields,
});

describe("scheduleToFormDefaults ↔ buildSchedulePayload round-trip", () => {
  const cases: RecurringSchedule[] = [
    { type: "day_of_month", day: 10, weekendAdjustment: "none" },
    { type: "day_of_month", day: 1, weekendAdjustment: "next_weekday" },
    { type: "last_day_of_month", weekendAdjustment: "next_weekday" },
    { type: "nth_weekday", ordinal: "last", weekday: 5, weekendAdjustment: "none" },
    { type: "nth_weekday", ordinal: 3, weekday: 3, weekendAdjustment: "none" },
    {
      type: "semi_monthly",
      days: [15, "last"],
      weekendAdjustment: "next_weekday",
    },
    {
      type: "every_n_weeks",
      interval: 2,
      anchorDate: "2026-07-10",
      weekendAdjustment: "none",
    },
  ];

  it.each(cases)("round-trips %o", (schedule) => {
    const fields = scheduleToFormDefaults(schedule);
    expect(buildSchedulePayload(enabled(fields))).toEqual(schedule);
  });
});

describe("buildSchedulePayload", () => {
  it("returns null when auto-apply is disabled", () => {
    const fields = scheduleToFormDefaults({
      type: "day_of_month",
      day: 5,
      weekendAdjustment: "none",
    });
    expect(
      buildSchedulePayload({ autoApplyEnabled: false, ...fields })
    ).toBeNull();
  });

  it("maps the weekend checkbox to the adjustment enum", () => {
    const base = scheduleToFormDefaults(null);
    expect(
      buildSchedulePayload(enabled({ ...base, scheduleDay: "3", weekendAdjustment: true }))
    ).toEqual({ type: "day_of_month", day: 3, weekendAdjustment: "next_weekday" });
  });

  it("never applies weekend adjustment to an nth-weekday schedule", () => {
    const base = scheduleToFormDefaults(null);
    // A stale weekend flag (e.g. left over from another family) must be ignored.
    expect(
      buildSchedulePayload(
        enabled({
          ...base,
          scheduleType: "nth_weekday",
          nthOrdinal: "1",
          nthWeekday: "0",
          weekendAdjustment: true,
        })
      )
    ).toEqual({
      type: "nth_weekday",
      ordinal: 1,
      weekday: 0,
      weekendAdjustment: "none",
    });
  });
});

describe("scheduleToFormDefaults", () => {
  it("provides sensible defaults when there is no schedule", () => {
    expect(scheduleToFormDefaults(null)).toEqual({
      scheduleType: "day_of_month",
      scheduleDay: "",
      nthOrdinal: "1",
      nthWeekday: "1",
      semiDay1: "15",
      semiDay2: "last",
      everyInterval: "2",
      everyAnchorDate: "",
      weekendAdjustment: false,
    });
  });
});

describe("formSchema validation", () => {
  const validItem = {
    paidBy: "john",
    tagIds: ["t1"],
    amount: "10.00",
    where: "FPL",
    notes: "",
    splitType: "split" as const,
    settlementType: "deferred" as const,
  };

  const base = {
    name: "Bills",
    items: [validItem],
    ...scheduleToFormDefaults(null),
  };

  it("passes with auto-apply off regardless of schedule fields", () => {
    expect(
      formSchema.safeParse({ ...base, autoApplyEnabled: false }).success
    ).toBe(true);
  });

  it("requires a valid day for day_of_month when enabled", () => {
    const bad = formSchema.safeParse({
      ...base,
      autoApplyEnabled: true,
      scheduleType: "day_of_month",
      scheduleDay: "40",
    });
    expect(bad.success).toBe(false);
  });

  it("rejects identical semi-monthly days", () => {
    const bad = formSchema.safeParse({
      ...base,
      autoApplyEnabled: true,
      scheduleType: "semi_monthly",
      semiDay1: "15",
      semiDay2: "15",
    });
    expect(bad.success).toBe(false);
  });

  it("requires an anchor date for every_n_weeks", () => {
    const bad = formSchema.safeParse({
      ...base,
      autoApplyEnabled: true,
      scheduleType: "every_n_weeks",
      everyInterval: "2",
      everyAnchorDate: "",
    });
    expect(bad.success).toBe(false);

    const good = formSchema.safeParse({
      ...base,
      autoApplyEnabled: true,
      scheduleType: "every_n_weeks",
      everyInterval: "2",
      everyAnchorDate: "2026-07-10",
    });
    expect(good.success).toBe(true);
  });

  it("accepts last_day_of_month with no extra params", () => {
    const good = formSchema.safeParse({
      ...base,
      autoApplyEnabled: true,
      scheduleType: "last_day_of_month",
    });
    expect(good.success).toBe(true);
  });
});
