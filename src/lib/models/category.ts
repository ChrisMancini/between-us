import mongoose, { Schema, type Document } from "mongoose";

export interface ICategory extends Document {
  name: string;
  settlementType: "immediate" | "deferred";
  sortOrder: number;
}

export interface SerializedCategory {
  _id: string;
  name: string;
  settlementType: "immediate" | "deferred";
  sortOrder: number;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    settlementType: {
      type: String,
      enum: ["immediate", "deferred"],
      required: true,
    },
    sortOrder: { type: Number, required: true },
  },
  { timestamps: false }
);

CategorySchema.index({ sortOrder: 1 });

export const Category =
  mongoose.models.Category ??
  mongoose.model<ICategory>("Category", CategorySchema);
