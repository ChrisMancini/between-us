import { getMonthDateRange } from "@/lib/utils";
import { escapeRegex } from "@/lib/escape-regex";
import { serializeTag } from "@/lib/tag-utils";
import type { SerializedExpense } from "@/lib/models/expense";

interface ExpenseFilters {
  month: number | null;
  year: number;
  q: string;
  tagFilter: string;
  paidByFilter: string;
}

type RawTagDoc = Record<string, unknown> & {
  _id: { toString(): string };
  path: string;
  sortOrder: number;
};

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

export function buildExpenseQuery(
  filters: ExpenseFilters,
  rawTags: RawTagDoc[]
): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (filters.month !== null) {
    const { start, end } = getMonthDateRange(filters.month, filters.year);
    query.date = { $gte: start, $lt: end };
  }

  if (filters.q) {
    const escaped = escapeRegex(filters.q);
    query.$or = [
      { where: { $regex: escaped, $options: "i" } },
      { notes: { $regex: escaped, $options: "i" } },
    ];
  }

  if (filters.paidByFilter) {
    query.paidBy = filters.paidByFilter;
  }

  if (filters.tagFilter) {
    const matchingTag = rawTags.find(
      (t) => t.path.toLowerCase() === filters.tagFilter.toLowerCase()
    );
    if (matchingTag) {
      const matchingIds = rawTags
        .filter(
          (t) =>
            t._id.toString() === matchingTag._id.toString() ||
            t.path.toLowerCase().startsWith(matchingTag.path.toLowerCase() + "/")
        )
        .map((t) => t._id);
      query.tags = { $in: matchingIds };
    }
  }

  return query;
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
