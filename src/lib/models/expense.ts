import mongoose, { Schema, type Document } from "mongoose";
import type { SerializedCategory } from "./category";

export interface IExpense extends Document {
  paidBy: string;
  date: Date;
  category: mongoose.Types.ObjectId;
  amount: number; // cents
  where: string;
  notes?: string;
  splitType: "split" | "full";
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedExpense {
  _id: string;
  paidBy: string;
  date: string;
  category: SerializedCategory;
  amount: number; // cents
  where: string;
  notes?: string;
  splitType: "split" | "full";
  createdAt: string;
  updatedAt: string;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    paidBy: { type: String, required: true },
    date: { type: Date, required: true },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    amount: { type: Number, required: true, min: 1 },
    where: { type: String, required: true, maxlength: 100 },
    notes: { type: String, maxlength: 500 },
    splitType: { type: String, enum: ["split", "full"], required: true },
  },
  { timestamps: true }
);

ExpenseSchema.index({ date: -1, createdAt: -1 });

export const Expense =
  mongoose.models.Expense ??
  mongoose.model<IExpense>("Expense", ExpenseSchema);
