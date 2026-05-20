import type {
  IRecurringTemplateItem,
  SerializedRecurringTemplateItem,
  SerializedRecurringTemplate,
} from "./models/recurring-template";

export function serializeTemplateItem(
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
