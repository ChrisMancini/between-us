import mongoose, { Schema, type Document } from "mongoose";

export interface IWidgetPreference {
  widgetId: string;
  collapsed: boolean;
}

export interface IUserPreference extends Document {
  userId: string;
  dashboard: {
    widgets: IWidgetPreference[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const WidgetPreferenceSchema = new Schema<IWidgetPreference>(
  {
    widgetId: { type: String, required: true },
    collapsed: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const UserPreferenceSchema = new Schema<IUserPreference>(
  {
    userId: { type: String, required: true },
    dashboard: {
      widgets: { type: [WidgetPreferenceSchema], default: [] },
    },
  },
  { timestamps: true }
);

UserPreferenceSchema.index({ userId: 1 }, { unique: true });

export const UserPreference =
  mongoose.models.UserPreference ??
  mongoose.model<IUserPreference>("UserPreference", UserPreferenceSchema);
