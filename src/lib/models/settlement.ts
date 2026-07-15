import mongoose, { Schema, type Document } from "mongoose";

export interface ISettlement extends Document {
  month: number; // 1–12
  year: number;
  status: "open" | "closed";
  totalOwed: number; // cents, always positive
  owedBy: string;
  owedTo: string;
  closedAt: Date;
  note?: string;
  // Directional breakdown amounts (populated on close/reopen, optional for backwards compatibility)
  person1OwesPerson2?: number; // cents
  person2OwesPerson1?: number; // cents
  // Set when a closed month is reopened; cleared on re-close
  previousTotalOwed?: number;
  previousOwedBy?: string;
  reopenedAt?: Date;
}

export interface SerializedSettlement {
  _id: string;
  month: number;
  year: number;
  status: "open" | "closed";
  totalOwed: number;
  owedBy: string;
  owedTo: string;
  closedAt: string;
  note?: string;
  person1OwesPerson2?: number;
  person2OwesPerson1?: number;
  previousTotalOwed?: number;
  previousOwedBy?: string;
  reopenedAt?: string;
}

const SettlementSchema = new Schema<ISettlement>({
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  status: { type: String, enum: ["open", "closed"], default: "closed" },
  totalOwed: { type: Number, required: true, min: 0 },
  owedBy: { type: String, required: true },
  owedTo: { type: String, required: true },
  closedAt: { type: Date, required: true },
  note: { type: String },
  person1OwesPerson2: { type: Number, min: 0 },
  person2OwesPerson1: { type: Number, min: 0 },
  previousTotalOwed: { type: Number },
  previousOwedBy: { type: String },
  reopenedAt: { type: Date },
});

SettlementSchema.index({ month: 1, year: 1 }, { unique: true });

export const Settlement =
  mongoose.models.Settlement ??
  mongoose.model<ISettlement>("Settlement", SettlementSchema);
