import mongoose from "mongoose";
import {
  RecurringTemplate,
  type RecurringSchedule,
} from "../recurring-template";

// Guards the schedule subschema against regressing to the day-of-month-only shape
// (a stale schema is what makes "every_n_weeks" fail to save). Runs in a fresh
// process, so it reflects the real compiled schema, not a dev HMR-cached one.

function makeDoc(schedule: RecurringSchedule) {
  return new RecurringTemplate({
    name: "T",
    createdBy: new mongoose.Types.ObjectId(),
    items: [
      {
        paidBy: "john",
        tagIds: [new mongoose.Types.ObjectId()],
        amount: 100,
        where: "FPL",
        splitType: "split",
        settlementType: "deferred",
      },
    ],
    autoApplyEnabled: true,
    autoApplyEnabledAt: new Date(),
    schedule,
  });
}

describe("RecurringTemplate schedule subschema", () => {
  const cases: [string, RecurringSchedule][] = [
    ["day_of_month", { type: "day_of_month", day: 10, weekendAdjustment: "none" }],
    [
      "last_day_of_month",
      { type: "last_day_of_month", weekendAdjustment: "next_weekday" },
    ],
    [
      "nth_weekday",
      { type: "nth_weekday", ordinal: "last", weekday: 5, weekendAdjustment: "none" },
    ],
    [
      "semi_monthly",
      { type: "semi_monthly", days: [15, "last"], weekendAdjustment: "none" },
    ],
    [
      "every_n_weeks",
      {
        type: "every_n_weeks",
        interval: 2,
        anchorDate: "2026-07-10",
        weekendAdjustment: "none",
      },
    ],
  ];

  it.each(cases)("accepts a %s schedule", (_name, schedule) => {
    expect(makeDoc(schedule).validateSync()).toBeUndefined();
  });

  it("persists the every_n_weeks fields", () => {
    const doc = makeDoc({
      type: "every_n_weeks",
      interval: 3,
      anchorDate: "2026-01-02",
      weekendAdjustment: "none",
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.schedule).toMatchObject({
      type: "every_n_weeks",
      interval: 3,
      anchorDate: "2026-01-02",
    });
  });

  it("rejects an unknown schedule type", () => {
    const err = makeDoc({
      type: "bogus",
    } as unknown as RecurringSchedule).validateSync();
    expect(err).toBeDefined();
  });
});
