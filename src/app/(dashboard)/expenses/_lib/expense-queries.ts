import { serializeTag } from "@/lib/tag-utils";
import type { SerializedExpense } from "@/lib/models/expense";
import type { RawTagDoc } from "@/lib/expense-query";
import { EXPENSE_PAGE_SIZE } from "./constants";

export { buildExpenseQuery } from "@/lib/expense-query";
export { EXPENSE_PAGE_SIZE };

interface RawSearchParams {
  q?: string;
  tag?: string;
  paidBy?: string;
  month?: string;
  year?: string;
  prefill_amount?: string;
  prefill_where?: string;
  prefill_date?: string;
  prefill_tags?: string;
}

export function parseExpenseParams(params: RawSearchParams) {
  const now = new Date();
  const month = params.month === "all" ? null : (params.month ? parseInt(params.month) : now.getMonth() + 1);
  const year = params.year ? parseInt(params.year) : now.getFullYear();
  const q = params.q?.trim() || "";
  const tagFilter = params.tag || "";
  const paidByFilter = params.paidBy || "";

  const prefill = (params.prefill_amount || params.prefill_where || params.prefill_date || params.prefill_tags)
    ? {
        amount: params.prefill_amount,
        where: params.prefill_where,
        date: params.prefill_date,
        tagIds: params.prefill_tags?.split(",").filter(Boolean),
      }
    : undefined;

  const isFiltered = !!(q || tagFilter || paidByFilter);

  return { month, year, q, tagFilter, paidByFilter, prefill, isFiltered };
}

export function serializeExpense(e: {
  _id: { toString(): string };
  paidBy: string;
  date: Date;
  tags?: unknown[];
  amount: number;
  where: string;
  notes?: string;
  splitType: string;
  settlementType: string;
  createdAt: Date;
  updatedAt: Date;
}): SerializedExpense {
  const expTags = (e.tags ?? []) as unknown as RawTagDoc[];
  return {
    _id: e._id.toString(),
    paidBy: e.paidBy,
    date: e.date.toISOString(),
    tags: expTags.map(serializeTag),
    amount: e.amount,
    where: e.where,
    notes: e.notes,
    splitType: e.splitType as SerializedExpense["splitType"],
    settlementType: e.settlementType as SerializedExpense["settlementType"],
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}
