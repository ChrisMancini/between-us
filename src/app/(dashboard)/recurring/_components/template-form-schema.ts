import { z } from "zod";
import type {
  RecurringSchedule,
  SemiMonthlyDay,
  WeekOrdinal,
  Weekday,
} from "@/lib/models/recurring-template";

/**
 * Form-facing schema and pure mappers for the recurring-template dialog. The form
 * holds every family's parameters as flat string/boolean fields (what inputs
 * produce); `buildSchedulePayload` collapses them into the discriminated
 * `RecurringSchedule` the API expects, and `scheduleToFormDefaults` expands a stored
 * schedule back into form fields for editing. Kept free of React so it is unit-tested
 * directly (the repo runs jest in a node environment).
 */

export const SCHEDULE_TYPES = [
  "day_of_month",
  "last_day_of_month",
  "nth_weekday",
  "semi_monthly",
  "every_n_weeks",
] as const;

export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  day_of_month: "Day of month",
  last_day_of_month: "Last day of month",
  nth_weekday: "Nth weekday of month",
  semi_monthly: "Semi-monthly (two days)",
  every_n_weeks: "Every N weeks",
};

export const ORDINAL_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "First" },
  { value: "2", label: "Second" },
  { value: "3", label: "Third" },
  { value: "4", label: "Fourth" },
  { value: "last", label: "Last" },
];

export const WEEKDAY_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const itemSchema = z.object({
  paidBy: z.string().min(1),
  tagIds: z.array(z.string()).min(1, "At least one tag is required"),
  amount: z
    .string()
    .min(1, "Required")
    .refine(
      (v) => /^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) > 0,
      "Enter a valid amount"
    ),
  where: z.string().min(1, "Required").max(100),
  notes: z.string().max(500).optional(),
  splitType: z.enum(["split", "full"]),
  settlementType: z.enum(["immediate", "deferred"]),
});

function isDayInRange(v: string): boolean {
  return /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 31;
}

function isSemiDay(v: string): boolean {
  return v === "last" || isDayInRange(v);
}

function isPositiveInt(v: string): boolean {
  return /^\d+$/.test(v) && Number(v) >= 1;
}

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

interface RawScheduleFields {
  scheduleDay: string;
  nthOrdinal: string;
  nthWeekday: string;
  semiDay1: string;
  semiDay2: string;
  everyInterval: string;
  everyAnchorDate: string;
}

type ScheduleValidator = (
  d: RawScheduleFields,
  ctx: z.RefinementCtx
) => void;

const issue = (
  ctx: z.RefinementCtx,
  path: string,
  message: string
): void => ctx.addIssue({ code: "custom", path: [path], message });

// One validator per family; the discriminated union means only the selected
// family's fields need to be complete (ADR-0018, decision 5).
const SCHEDULE_VALIDATORS: Record<ScheduleType, ScheduleValidator> = {
  day_of_month: (d, ctx) => {
    if (!isDayInRange(d.scheduleDay)) {
      issue(ctx, "scheduleDay", "Enter a day from 1 to 31");
    }
  },
  last_day_of_month: () => {},
  nth_weekday: (d, ctx) => {
    if (!d.nthOrdinal) issue(ctx, "nthOrdinal", "Choose which week");
    if (!d.nthWeekday) issue(ctx, "nthWeekday", "Choose a weekday");
  },
  semi_monthly: (d, ctx) => {
    const dayMsg = "Enter a day from 1 to 31 or “last”";
    if (!isSemiDay(d.semiDay1)) issue(ctx, "semiDay1", dayMsg);
    if (!isSemiDay(d.semiDay2)) issue(ctx, "semiDay2", dayMsg);
    else if (d.semiDay1 === d.semiDay2) {
      issue(ctx, "semiDay2", "The two days must differ");
    }
  },
  every_n_weeks: (d, ctx) => {
    if (!isPositiveInt(d.everyInterval)) {
      issue(ctx, "everyInterval", "Enter a whole number of weeks");
    }
    if (!isIsoDate(d.everyAnchorDate)) {
      issue(ctx, "everyAnchorDate", "Choose a start date");
    }
  },
};

export const formSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100),
    items: z.array(itemSchema).min(1, "Add at least one item"),
    autoApplyEnabled: z.boolean(),
    scheduleType: z.enum(SCHEDULE_TYPES),
    scheduleDay: z.string(),
    nthOrdinal: z.string(),
    nthWeekday: z.string(),
    semiDay1: z.string(),
    semiDay2: z.string(),
    everyInterval: z.string(),
    everyAnchorDate: z.string(),
    weekendAdjustment: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (!d.autoApplyEnabled) return;
    SCHEDULE_VALIDATORS[d.scheduleType](d, ctx);
  });

export type FormValues = z.infer<typeof formSchema>;

export interface ScheduleFormFields {
  scheduleType: ScheduleType;
  scheduleDay: string;
  nthOrdinal: string;
  nthWeekday: string;
  semiDay1: string;
  semiDay2: string;
  everyInterval: string;
  everyAnchorDate: string;
  weekendAdjustment: boolean;
}

type SchedulePayloadInput = { autoApplyEnabled: boolean } & ScheduleFormFields;

/**
 * Whether the current family's parameters are complete enough to build a schedule.
 * Used by the live preview to avoid rendering a summary for half-typed input.
 */
export function isScheduleComplete(fields: ScheduleFormFields): boolean {
  switch (fields.scheduleType) {
    case "day_of_month":
      return isDayInRange(fields.scheduleDay);
    case "last_day_of_month":
      return true;
    case "nth_weekday":
      return !!fields.nthOrdinal && !!fields.nthWeekday;
    case "semi_monthly":
      return (
        isSemiDay(fields.semiDay1) &&
        isSemiDay(fields.semiDay2) &&
        fields.semiDay1 !== fields.semiDay2
      );
    case "every_n_weeks":
      return (
        isPositiveInt(fields.everyInterval) && isIsoDate(fields.everyAnchorDate)
      );
  }
}

function parseOrdinal(v: string): WeekOrdinal {
  return v === "last" ? "last" : (Number(v) as Exclude<WeekOrdinal, "last">);
}

function parseSemiDay(v: string): SemiMonthlyDay {
  return v === "last" ? "last" : Number(v);
}

/** Collapse the flat form fields into the discriminated schedule the API expects. */
export function buildSchedulePayload(
  values: SchedulePayloadInput
): RecurringSchedule | null {
  if (!values.autoApplyEnabled) return null;
  const weekendAdjustment = values.weekendAdjustment ? "next_weekday" : "none";

  switch (values.scheduleType) {
    case "day_of_month":
      return {
        type: "day_of_month",
        day: Number(values.scheduleDay),
        weekendAdjustment,
      };
    case "last_day_of_month":
      return { type: "last_day_of_month", weekendAdjustment };
    case "nth_weekday":
      // Weekend adjustment is meaningless when the weekday is chosen explicitly, so
      // it is never offered for this family — keep it off regardless of stale state.
      return {
        type: "nth_weekday",
        ordinal: parseOrdinal(values.nthOrdinal),
        weekday: Number(values.nthWeekday) as Weekday,
        weekendAdjustment: "none",
      };
    case "semi_monthly":
      return {
        type: "semi_monthly",
        days: [parseSemiDay(values.semiDay1), parseSemiDay(values.semiDay2)],
        weekendAdjustment,
      };
    case "every_n_weeks":
      return {
        type: "every_n_weeks",
        interval: Number(values.everyInterval),
        anchorDate: values.everyAnchorDate,
        weekendAdjustment,
      };
  }
}

/** Expand a stored schedule (or none) into form defaults for editing. */
export function scheduleToFormDefaults(
  schedule: RecurringSchedule | null | undefined
): ScheduleFormFields {
  const base: ScheduleFormFields = {
    scheduleType: "day_of_month",
    scheduleDay: "",
    nthOrdinal: "1",
    nthWeekday: "1",
    semiDay1: "15",
    semiDay2: "last",
    everyInterval: "2",
    everyAnchorDate: "",
    weekendAdjustment: false,
  };
  if (!schedule) return base;

  const weekendAdjustment = schedule.weekendAdjustment === "next_weekday";
  switch (schedule.type) {
    case "day_of_month":
      return {
        ...base,
        scheduleType: "day_of_month",
        scheduleDay: String(schedule.day),
        weekendAdjustment,
      };
    case "last_day_of_month":
      return { ...base, scheduleType: "last_day_of_month", weekendAdjustment };
    case "nth_weekday":
      return {
        ...base,
        scheduleType: "nth_weekday",
        nthOrdinal: String(schedule.ordinal),
        nthWeekday: String(schedule.weekday),
        weekendAdjustment,
      };
    case "semi_monthly":
      return {
        ...base,
        scheduleType: "semi_monthly",
        semiDay1: String(schedule.days[0]),
        semiDay2: String(schedule.days[1]),
        weekendAdjustment,
      };
    case "every_n_weeks":
      return {
        ...base,
        scheduleType: "every_n_weeks",
        everyInterval: String(schedule.interval),
        everyAnchorDate: schedule.anchorDate,
        weekendAdjustment,
      };
  }
}
