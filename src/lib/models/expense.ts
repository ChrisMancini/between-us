import mongoose, { Schema, type Document } from "mongoose";
import type { SerializedTag } from "./tag";

export interface IExpense extends Document {
  paidBy: string;
  date: Date;
  tags: mongoose.Types.ObjectId[];
  amount: number; // cents
  where: string;
  notes?: string;
  splitType: "split" | "full";
  settlementType: "immediate" | "deferred";
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedExpense {
  _id: string;
  paidBy: string;
  date: string;
  tags: SerializedTag[];
  amount: number; // cents
  where: string;
  notes?: string;
  splitType: "split" | "full";
  settlementType: "immediate" | "deferred";
  createdAt: string;
  updatedAt: string;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    paidBy: { type: String, required: true },
    date: { type: Date, required: true },
    tags: {
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
  { timestamps: true }
);

ExpenseSchema.index({ date: -1, createdAt: -1 });
ExpenseSchema.index({ tags: 1 });

export const Expense =
  mongoose.models.Expense ??
  mongoose.model<IExpense>("Expense", ExpenseSchema);
