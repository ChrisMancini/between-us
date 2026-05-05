import mongoose, { Schema, type Document } from "mongoose";

export interface ISettlement extends Document {
  month: number; // 1–12
  year: number;
  status: "open" | "closed";
  totalOwed: number; // cents, always positive
  owedBy: string;
  owedTo: string;
  closedAt: Date;
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
  previousTotalOwed: { type: Number },
  previousOwedBy: { type: String },
  reopenedAt: { type: Date },
});

SettlementSchema.index({ month: 1, year: 1 }, { unique: true });

export const Settlement =
  mongoose.models.Settlement ??
  mongoose.model<ISettlement>("Settlement", SettlementSchema);
