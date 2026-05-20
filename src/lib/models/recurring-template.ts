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

export interface IRecurringTemplate extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  items: IRecurringTemplateItem[];
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
