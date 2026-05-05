import mongoose, { Schema, type Document } from "mongoose";

export type { SerializedPerson } from "@/types/person";

export interface IPerson extends Document {
  key: string;
  displayName: string;
  role: "admin" | "user";
  colorIndex: 0 | 1;
  emails?: Map<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const PersonSchema = new Schema<IPerson>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    colorIndex: {
      type: Number,
      enum: [0, 1],
      required: true,
    },
    emails: {
      type: Map,
      of: { type: String, lowercase: true, trim: true },
    },
  },
  { timestamps: true }
);

export const Person =
  mongoose.models.Person ?? mongoose.model<IPerson>("Person", PersonSchema);
