import mongoose, { Schema, type Document } from "mongoose";

/**
 * Ledger of applied recurring-template occurrences (ADR-0018, decision 3).
 *
 * One document per applied occurrence, keyed `(templateId, occurrenceDate)` with a
 * unique index. The runner atomically claims an occurrence before applying it, so an
 * occurrence applies **exactly once** across restarts, concurrent triggers, and
 * repeated runs. State is two-phase (`claimed` → `completed`); an occurrence left
 * `claimed` past a timeout (a run that died mid-apply) is re-claimed and retried
 * on a later run (#78).
 */
interface IRecurringApplyLog extends Document {
  templateId: mongoose.Types.ObjectId;
  /** UTC-midnight date of the occurrence being applied. */
  occurrenceDate: Date;
  status: "claimed" | "completed";
  claimedAt: Date;
  completedAt: Date | null;
  /** Number of expenses created for the occurrence (set when completed). */
  addedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const RecurringApplyLogSchema = new Schema<IRecurringApplyLog>(
  {
    templateId: {
      type: Schema.Types.ObjectId,
      ref: "RecurringTemplate",
      required: true,
    },
    occurrenceDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["claimed", "completed"],
      required: true,
      default: "claimed",
    },
    claimedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    addedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

RecurringApplyLogSchema.index(
  { templateId: 1, occurrenceDate: 1 },
  { unique: true }
);

export const RecurringApplyLog =
  mongoose.models.RecurringApplyLog ??
  mongoose.model<IRecurringApplyLog>(
    "RecurringApplyLog",
    RecurringApplyLogSchema
  );
