import mongoose, { Schema, type Document } from "mongoose";

interface IAppSettings extends Document {
  authMethod: "basic" | "oauth";
  oauthProvider: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    authMethod: {
      type: String,
      enum: ["basic", "oauth"],
      default: "basic",
    },
    oauthProvider: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export const AppSettings =
  mongoose.models.AppSettings ??
  mongoose.model<IAppSettings>("AppSettings", AppSettingsSchema);
