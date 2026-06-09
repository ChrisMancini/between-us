import mongoose, { Schema, type Document, type Types } from "mongoose";

const ACTION_STATUSES = [
  "pending",
  "paid",
  "confirmed",
  "cancelled",
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

const ACTION_SOURCE_TYPES = ["expense", "settlement"] as const;

export type ActionSourceType = (typeof ACTION_SOURCE_TYPES)[number];

export interface IAction extends Document {
  sourceType: ActionSourceType;
  sourceId: Types.ObjectId;
  debtorKey: string;
  creditorKey: string;
  amount: number;
  status: ActionStatus;
  cancelReason?: string;
  description: string;
  paidAt?: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedAction {
  _id: string;
  sourceType: ActionSourceType;
  sourceId: string;
  debtorKey: string;
  creditorKey: string;
  amount: number;
  status: ActionStatus;
  cancelReason?: string;
  description: string;
  paidAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

const ActionSchema = new Schema<IAction>(
  {
    sourceType: {
      type: String,
      enum: ACTION_SOURCE_TYPES,
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    debtorKey: { type: String, required: true },
    creditorKey: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ACTION_STATUSES,
      default: "pending",
      required: true,
    },
    cancelReason: { type: String },
    description: { type: String, required: true },
    paidAt: { type: Date },
    confirmedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

ActionSchema.index({ sourceType: 1, sourceId: 1 });
ActionSchema.index({ status: 1, debtorKey: 1 });
ActionSchema.index({ status: 1, creditorKey: 1 });
ActionSchema.index({ createdAt: -1 });

export const Action =
  mongoose.models.Action ??
  mongoose.model<IAction>("Action", ActionSchema);

type ActionLike = {
  _id: unknown;
  sourceType: ActionSourceType;
  sourceId: unknown;
  debtorKey: string;
  creditorKey: string;
  amount: number;
  status: ActionStatus;
  cancelReason?: string;
  description: string;
  paidAt?: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeAction(doc: ActionLike): SerializedAction {
  return {
    _id: String(doc._id),
    sourceType: doc.sourceType,
    sourceId: String(doc.sourceId),
    debtorKey: doc.debtorKey,
    creditorKey: doc.creditorKey,
    amount: doc.amount,
    status: doc.status,
    cancelReason: doc.cancelReason,
    description: doc.description,
    paidAt: doc.paidAt?.toISOString(),
    confirmedAt: doc.confirmedAt?.toISOString(),
    cancelledAt: doc.cancelledAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
