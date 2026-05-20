import mongoose, { Schema, type Document } from "mongoose";

export interface ITagMapping {
  sourceValue: string;
  tagIds: mongoose.Types.ObjectId[];
}

export interface ICsvFormat extends Document {
  name: string;
  dateColumn: string;
  dateFormat: "MM/DD/YYYY" | "YYYY-MM-DD" | "MM-DD-YYYY" | "DD/MM/YYYY";
  descriptionColumn: string;
  amountType: "separate" | "single";
  debitColumn?: string;
  creditColumn?: string;
  amountColumn?: string;
  purchaseSign?: "positive" | "negative";
  tagColumn?: string;
  notesColumn?: string;
  tagMappings: ITagMapping[];
}

export interface SerializedTagMapping {
  sourceValue: string;
  tagIds: string[];
}

export interface SerializedCsvFormat {
  _id: string;
  name: string;
  dateColumn: string;
  dateFormat: "MM/DD/YYYY" | "YYYY-MM-DD" | "MM-DD-YYYY" | "DD/MM/YYYY";
  descriptionColumn: string;
  amountType: "separate" | "single";
  debitColumn?: string;
  creditColumn?: string;
  amountColumn?: string;
  purchaseSign?: "positive" | "negative";
  tagColumn?: string;
  notesColumn?: string;
  tagMappings: SerializedTagMapping[];
}

const TagMappingSchema = new Schema<ITagMapping>(
  {
    sourceValue: { type: String, required: true },
    tagIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
      required: true,
    },
  },
  { _id: false }
);

const CsvFormatSchema = new Schema<ICsvFormat>(
  {
    name: { type: String, required: true, unique: true },
    dateColumn: { type: String, required: true },
    dateFormat: {
      type: String,
      enum: ["MM/DD/YYYY", "YYYY-MM-DD", "MM-DD-YYYY", "DD/MM/YYYY"],
      required: true,
    },
    descriptionColumn: { type: String, required: true },
    amountType: {
      type: String,
      enum: ["separate", "single"],
      required: true,
    },
    debitColumn: { type: String },
    creditColumn: { type: String },
    amountColumn: { type: String },
    purchaseSign: { type: String, enum: ["positive", "negative"] },
    tagColumn: { type: String },
    notesColumn: { type: String },
    tagMappings: { type: [TagMappingSchema], default: [] },
  },
  { timestamps: false }
);

export const CsvFormat =
  mongoose.models.CsvFormat ??
  mongoose.model<ICsvFormat>("CsvFormat", CsvFormatSchema);
