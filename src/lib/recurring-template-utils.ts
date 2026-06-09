import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { Tag } from "./models/tag";
import type {
  IRecurringTemplateItem,
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
): Promise<NextResponse | null> {
  for (const item of items) {
    for (const tagId of item.tagIds) {
      if (!mongoose.isValidObjectId(tagId)) {
        return NextResponse.json(
          { error: `Invalid tag ID: ${tagId}` },
          { status: 400 }
        );
      }
    }
  }

  const allTagIds = [...new Set(items.flatMap((i) => i.tagIds))];
  const existingTags = await Tag.find({ _id: { $in: allTagIds } }).lean();
  if (existingTags.length !== allTagIds.length) {
    return NextResponse.json(
      { error: "One or more tags not found" },
      { status: 422 }
    );
  }

  return null;
}

export function serializeTemplate(
  t: Record<string, unknown> & {
    _id: unknown;
    name: string;
    items: IRecurringTemplateItem[];
    createdAt: Date;
    updatedAt: Date;
  }
): SerializedRecurringTemplate {
  return {
    _id: String(t._id),
    name: t.name,
    items: t.items.map(serializeTemplateItem),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
