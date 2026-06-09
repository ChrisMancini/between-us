import mongoose, { Schema, type Document } from "mongoose";

interface IMonthReadiness extends Document {
  month: number;
  year: number;
  doneBy: string[];
}

const MonthReadinessSchema = new Schema<IMonthReadiness>({
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  doneBy: { type: [String], default: [] },
});

MonthReadinessSchema.index({ month: 1, year: 1 }, { unique: true });

export const MonthReadiness =
  mongoose.models.MonthReadiness ??
  mongoose.model<IMonthReadiness>("MonthReadiness", MonthReadinessSchema);
