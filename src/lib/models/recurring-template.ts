import mongoose, { Schema, type Document } from "mongoose";

export interface IRecurringTemplateItem {
  paidBy: string;
  tagIds: mongoose.Types.ObjectId[];
  amount: number; // cents
  where: string;
  notes?: string;
  splitType: "split" | "full";
  settlementType: "immediate" | "deferred";
}

/**
 * Schedule is a discriminated union over schedule families (ADR-0018, decision 2).
 * `type` is the discriminant so new families slot in without reshaping stored
 * documents. All five families ship as of #77.
 */

/**
 * Weekend business-day adjustment. "next_weekday" rolls a Sat/Sun occurrence
 * forward to the following Monday; "none" leaves it untouched. Absent is treated
 * as "none" by the occurrence math (older documents and the tracer bullet predate
 * this field).
 */
export type WeekendAdjustment = "none" | "next_weekday";

/** Ordinal week within a month for the nth-weekday family. */
export type WeekOrdinal = 1 | 2 | 3 | 4 | "last";

/** Day of the week, 0 = Sunday … 6 = Saturday (matches Date#getUTCDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A semi-monthly day: a 1–31 day-of-month or the month's last day. */
export type SemiMonthlyDay = number | "last";

interface ScheduleBase {
  /** Weekend roll-forward, applied to the computed date. Absent ⇒ "none". */
  weekendAdjustment?: WeekendAdjustment;
}

export interface DayOfMonthSchedule extends ScheduleBase {
  type: "day_of_month";
  /** 1–31, clamped to the last valid day of the month at occurrence time. */
  day: number;
}

export interface LastDayOfMonthSchedule extends ScheduleBase {
  type: "last_day_of_month";
}

export interface NthWeekdaySchedule extends ScheduleBase {
  type: "nth_weekday";
  /** 1st–4th, or the last occurrence of the weekday in the month. */
  ordinal: WeekOrdinal;
  weekday: Weekday;
}

export interface SemiMonthlySchedule extends ScheduleBase {
  type: "semi_monthly";
  /** Two fixed days each month; each may be a day-of-month or "last". */
  days: [SemiMonthlyDay, SemiMonthlyDay];
}

export interface EveryNWeeksSchedule extends ScheduleBase {
  type: "every_n_weeks";
  /** Interval in weeks (N ≥ 1); the cadence drifts across the calendar. */
  interval: number;
  /** Anchor start date as "YYYY-MM-DD" (UTC); the first occurrence. */
  anchorDate: string;
}

export type RecurringSchedule =
  | DayOfMonthSchedule
  | LastDayOfMonthSchedule
  | NthWeekdaySchedule
  | SemiMonthlySchedule
  | EveryNWeeksSchedule;

interface IRecurringTemplate extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  items: IRecurringTemplateItem[];
  autoApplyEnabled: boolean;
  autoApplyEnabledAt: Date | null;
  schedule: RecurringSchedule | null;
  lastAppliedAt: Date | null;
  applyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedRecurringTemplateItem {
  paidBy: string;
  tagIds: string[];
  amount: number;
  where: string;
  notes?: string;
  splitType: "split" | "full";
  settlementType: "immediate" | "deferred";
}

export interface SerializedRecurringTemplate {
  _id: string;
  name: string;
  items: SerializedRecurringTemplateItem[];
  autoApplyEnabled: boolean;
  autoApplyEnabledAt: string | null;
  schedule: RecurringSchedule | null;
  lastAppliedAt: string | null;
  applyCount: number;
  createdAt: string;
  updatedAt: string;
}

const RecurringTemplateItemSchema = new Schema<IRecurringTemplateItem>(
  {
    paidBy: { type: String, required: true },
    tagIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
      required: true,
      validate: {
        validator: (v: mongoose.Types.ObjectId[]) => v.length >= 1,
        message: "At least one tag is required",
      },
    },
    amount: { type: Number, required: true, min: 1 },
    where: { type: String, required: true, maxlength: 100 },
    notes: { type: String, maxlength: 500 },
    splitType: { type: String, enum: ["split", "full"], required: true },
    settlementType: {
      type: String,
      enum: ["immediate", "deferred"],
      required: true,
    },
  },
  { _id: false }
);

const RecurringTemplateSchema = new Schema<IRecurringTemplate>(
  {
    name: { type: String, required: true, maxlength: 100 },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Person",
      required: true,
    },
    items: {
      type: [RecurringTemplateItemSchema],
      required: true,
      validate: {
        validator: (v: IRecurringTemplateItem[]) => v.length >= 1,
        message: "At least one item is required",
      },
    },
    autoApplyEnabled: { type: Boolean, default: false },
    autoApplyEnabledAt: { type: Date, default: null },
    schedule: {
      // A permissive holder for the discriminated union — the Zod schema at the
      // API boundary is the real validator; Mongoose just persists the fields.
      type: new Schema(
        {
          type: {
            type: String,
            enum: [
              "day_of_month",
              "last_day_of_month",
              "nth_weekday",
              "semi_monthly",
              "every_n_weeks",
            ],
            required: true,
          },
          day: { type: Number, min: 1, max: 31 },
          ordinal: { type: Schema.Types.Mixed }, // 1–4 or "last"
          weekday: { type: Number, min: 0, max: 6 },
          days: { type: [Schema.Types.Mixed] }, // (number | "last")[]
          interval: { type: Number, min: 1 },
          anchorDate: { type: String },
          weekendAdjustment: {
            type: String,
            enum: ["none", "next_weekday"],
            default: "none",
          },
        },
        { _id: false }
      ),
      default: null,
    },
    lastAppliedAt: { type: Date, default: null },
    applyCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

RecurringTemplateSchema.index({ createdBy: 1 });

export const RecurringTemplate =
  mongoose.models.RecurringTemplate ??
  mongoose.model<IRecurringTemplate>(
    "RecurringTemplate",
    RecurringTemplateSchema
  );
