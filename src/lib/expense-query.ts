import { getMonthDateRange } from "@/lib/utils";
import { escapeRegex } from "@/lib/escape-regex";

export interface ExpenseQueryFilters {
  month: number | null;
  year: number;
  q: string;
  tagFilter: string;
  paidByFilter: string;
}

export type RawTagDoc = Record<string, unknown> & {
  _id: { toString(): string };
  path: string;
  sortOrder: number;
};

export function buildExpenseQuery(
  filters: ExpenseQueryFilters,
  rawTags: RawTagDoc[],
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
      (t) => t.path.toLowerCase() === filters.tagFilter.toLowerCase(),
    );
    if (matchingTag) {
      const matchingIds = rawTags
        .filter(
          (t) =>
            t._id.toString() === matchingTag._id.toString() ||
            t.path.toLowerCase().startsWith(matchingTag.path.toLowerCase() + "/"),
        )
        .map((t) => t._id);
      query.tags = { $in: matchingIds };
    }
  }

  return query;
}
