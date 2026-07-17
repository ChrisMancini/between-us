import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { Tag } from "./models/tag";
import { collapseToMostSpecific } from "./tag-hierarchy";
import type {
  IRecurringTemplateItem,
  RecurringSchedule,
  SerializedRecurringTemplateItem,
  SerializedRecurringTemplate,
} from "./models/recurring-template";

function serializeTemplateItem(
  item: IRecurringTemplateItem
): SerializedRecurringTemplateItem {
  return {
    paidBy: item.paidBy,
    tagIds: item.tagIds.map((id) => id.toString()),
    amount: item.amount,
    where: item.where,
    notes: item.notes,
    splitType: item.splitType,
    settlementType: item.settlementType,
  };
}

export async function validateTemplateTagIds(
  items: Array<{ tagIds: string[] }>
): Promise<{ error: NextResponse } | { error: null; pathById: Map<string, string> }> {
  for (const item of items) {
    for (const tagId of item.tagIds) {
      if (!mongoose.isValidObjectId(tagId)) {
        return {
          error: NextResponse.json(
            { error: `Invalid tag ID: ${tagId}` },
            { status: 400 }
          ),
        };
      }
    }
  }

  const allTagIds = [...new Set(items.flatMap((i) => i.tagIds))];
  const existingTags = await Tag.find({ _id: { $in: allTagIds } }).lean();
  if (existingTags.length !== allTagIds.length) {
    return {
      error: NextResponse.json(
        { error: "One or more tags not found" },
        { status: 422 }
      ),
    };
  }

  const pathById = new Map(existingTags.map((t) => [String(t._id), t.path as string]));
  return { error: null, pathById };
}

export function normalizeTemplateItemTagIds<T extends { tagIds: string[] }>(
  items: T[],
  pathById: Map<string, string>
): T[] {
  return items.map((item) => ({
    ...item,
    tagIds: collapseToMostSpecific(item.tagIds, pathById),
  }));
}

export function serializeTemplate(
  t: Record<string, unknown> & {
    _id: unknown;
    name: string;
    items: IRecurringTemplateItem[];
    autoApplyEnabled?: boolean;
    autoApplyEnabledAt?: Date | null;
    schedule?: RecurringSchedule | null;
    lastAppliedAt: Date | null;
    applyCount: number;
    createdAt: Date;
    updatedAt: Date;
  }
): SerializedRecurringTemplate {
  return {
    _id: String(t._id),
    name: t.name,
    items: t.items.map(serializeTemplateItem),
    autoApplyEnabled: t.autoApplyEnabled ?? false,
    autoApplyEnabledAt: t.autoApplyEnabledAt
      ? t.autoApplyEnabledAt.toISOString()
      : null,
    schedule: t.schedule ?? null,
    lastAppliedAt: t.lastAppliedAt ? t.lastAppliedAt.toISOString() : null,
    applyCount: t.applyCount,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
