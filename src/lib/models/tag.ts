import mongoose, { Schema, type Document } from "mongoose";

export interface ITag extends Document {
  path: string;
  sortOrder: number;
}

export interface SerializedTag {
  _id: string;
  path: string;
  sortOrder: number;
  name: string;
  parent: string;
  depth: number;
}

const TagSchema = new Schema<ITag>(
  {
    path: { type: String, required: true },
    sortOrder: { type: Number, required: true },
  },
  { timestamps: false }
);

TagSchema.index(
  { path: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
TagSchema.index({ sortOrder: 1 });

export const Tag =
  mongoose.models.Tag ?? mongoose.model<ITag>("Tag", TagSchema);
