import mongoose, { Schema, type Document } from "mongoose";

export const ACTIVITY_ACTIONS = [
  "expense_create",
  "expense_edit",
  "expense_delete",
  "settlement_close",
  "settlement_reopen",
  "recurring_apply",
  "csv_import",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface IActivity extends Document {
  action: ActivityAction;
  actorKey: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedActivity {
  _id: string;
  action: ActivityAction;
  actorKey: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const ActivitySchema = new Schema<IActivity>(
  {
    action: {
      type: String,
      enum: ACTIVITY_ACTIONS,
      required: true,
    },
    actorKey: { type: String, required: true },
    summary: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ActivitySchema.index({ createdAt: -1 });
ActivitySchema.index({ actorKey: 1, createdAt: -1 });

export const Activity =
  mongoose.models.Activity ??
  mongoose.model<IActivity>("Activity", ActivitySchema);
