export interface MonthlyTotal {
  month: number;
  year: number;
  deferredTotal: number;
  immediateTotal: number;
  total: number;
}

export interface TagTotal {
  tagPath: string;
  tagName: string;
  settlementType: "immediate" | "deferred";
  person1Paid: number;
  person2Paid: number;
  total: number;
}

export interface SimpleTagTotal {
  tagName: string;
  total: number;
}

export interface ExpenseDetail {
  date: string;
  where: string;
  paidBy: string;
  amount: number;
  splitType: "split" | "full";
  notes?: string;
  tagName: string;
}

export interface PersonSummary {
  deferredTotal: number;
  immediateTotal: number;
  person1Total: number;
  person2Total: number;
  totalSpending: number;
}

export function generateMonthEntries(
  year: number,
  startMonth: number,
  count: number
): Array<{ month: number; year: number }> {
  const entries: Array<{ month: number; year: number }> = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(year, startMonth - 1 + i, 1));
    entries.push({ month: d.getUTCMonth() + 1, year: d.getUTCFullYear() });
  }
  return entries;
}

export function buildTrendSeries(
  trendAgg: Array<{
    _id: { year: number; month: number; settlementType: string };
    total: number;
  }>,
  months: Array<{ month: number; year: number }>
): MonthlyTotal[] {
  const trendMap = new Map<string, MonthlyTotal>();

  for (const m of months) {
    trendMap.set(`${m.year}-${m.month}`, {
      month: m.month,
      year: m.year,
      deferredTotal: 0,
      immediateTotal: 0,
      total: 0,
    });
  }

  for (const row of trendAgg) {
    const key = `${row._id.year}-${row._id.month}`;
    const entry = trendMap.get(key);
    if (!entry) continue;
    if (row._id.settlementType === "deferred") {
      entry.deferredTotal += row.total;
    } else {
      entry.immediateTotal += row.total;
    }
    entry.total += row.total;
  }

  return [...trendMap.values()];
}

interface TagPersonAggRow {
  _id: { tagPath: string; tagSortOrder: number; paidBy: string };
  total: number;
  count?: number;
}

interface TagLean {
  path: string;
  sortOrder: number;
}

export function buildTagTotals(
  tagPersonAgg: TagPersonAggRow[],
  allTags: TagLean[],
  person1Key: string
): TagTotal[] {
  const tagMap = new Map<string, TagTotal>();

  for (const tag of allTags) {
    const segments = tag.path.split("/");
    tagMap.set(tag.path, {
      tagPath: tag.path,
      tagName: segments[segments.length - 1],
      settlementType: "deferred",
      person1Paid: 0,
      person2Paid: 0,
      total: 0,
    });
  }

  for (const row of tagPersonAgg) {
    const key = row._id.tagPath;
    let entry = tagMap.get(key);
    if (!entry) {
      const segments = key.split("/");
      entry = {
        tagPath: key,
        tagName: segments[segments.length - 1],
        settlementType: "deferred",
        person1Paid: 0,
        person2Paid: 0,
        total: 0,
      };
      tagMap.set(key, entry);
    }
    if (row._id.paidBy === person1Key) {
      entry.person1Paid += row.total;
    } else {
      entry.person2Paid += row.total;
    }
    entry.total += row.total;
  }

  return [...tagMap.values()].sort((a, b) => {
    const ai = allTags.findIndex((t) => t.path === a.tagPath);
    const bi = allTags.findIndex((t) => t.path === b.tagPath);
    return ai - bi;
  });
}

export function buildSimpleTagTotals(
  tagPersonAgg: TagPersonAggRow[],
  allTags: TagLean[]
): SimpleTagTotal[] {
  const tagMap = new Map<string, SimpleTagTotal>();

  for (const tag of allTags) {
    tagMap.set(tag.path, { tagName: tag.path, total: 0 });
  }

  for (const row of tagPersonAgg) {
    const key = row._id.tagPath;
    let entry = tagMap.get(key);
    if (!entry) {
      entry = { tagName: key, total: 0 };
      tagMap.set(key, entry);
    }
    entry.total += row.total;
  }

  return [...tagMap.values()].sort((a, b) => {
    const ai = allTags.findIndex((t) => t.path === a.tagName);
    const bi = allTags.findIndex((t) => t.path === b.tagName);
    return ai - bi;
  });
}

interface RawExpense {
  date: Date;
  where: string;
  paidBy: string;
  amount: number;
  splitType: string;
  notes?: string;
  tags?: Array<{ path: string }>;
  settlementType: string;
}

export function groupExpensesByTag(
  rawExpenses: RawExpense[]
): Record<string, ExpenseDetail[]> {
  const result: Record<string, ExpenseDetail[]> = {};

  for (const e of rawExpenses) {
    const eTags = (e.tags ?? []) as Array<{ path: string }>;
    for (const tag of eTags) {
      if (!result[tag.path]) {
        result[tag.path] = [];
      }
      result[tag.path].push({
        date: e.date.toISOString(),
        where: e.where,
        paidBy: e.paidBy,
        amount: e.amount,
        splitType: e.splitType as "split" | "full",
        notes: e.notes,
        tagName: tag.path,
      });
    }
  }

  return result;
}

export function computePersonSummary(
  rawExpenses: RawExpense[],
  person1Key: string
): PersonSummary {
  let deferredTotal = 0;
  let immediateTotal = 0;
  let person1Total = 0;
  let person2Total = 0;

  for (const e of rawExpenses) {
    if (e.settlementType === "deferred") {
      deferredTotal += e.amount;
    } else {
      immediateTotal += e.amount;
    }
    if (e.paidBy === person1Key) {
      person1Total += e.amount;
    } else {
      person2Total += e.amount;
    }
  }

  return {
    deferredTotal,
    immediateTotal,
    person1Total,
    person2Total,
    totalSpending: deferredTotal + immediateTotal,
  };
}

interface PersonSummaryAggRow {
  _id: { settlementType: string; paidBy: string };
  total: number;
}

export function computePersonSummaryFromAgg(
  rows: PersonSummaryAggRow[],
  person1Key: string
): PersonSummary {
  let deferredTotal = 0;
  let immediateTotal = 0;
  let person1Total = 0;
  let person2Total = 0;

  for (const row of rows) {
    if (row._id.settlementType === "deferred") {
      deferredTotal += row.total;
    } else {
      immediateTotal += row.total;
    }
    if (row._id.paidBy === person1Key) {
      person1Total += row.total;
    } else {
      person2Total += row.total;
    }
  }

  return {
    deferredTotal,
    immediateTotal,
    person1Total,
    person2Total,
    totalSpending: deferredTotal + immediateTotal,
  };
}

export function computeHighlights(
  biggestExpenseResult: RawExpense | null,
  topMerchantAgg: Array<{ _id: string; count: number; total: number }>,
  monthlyTotals: MonthlyTotal[]
): {
  biggestExpense: { amount: number; where: string; date: string; tagNames: string; paidBy: string } | null;
  topMerchant: { where: string; count: number; total: number } | null;
  busiestMonth: { month: number; year: number; total: number } | null;
} {
  let biggestExpense = null;
  if (biggestExpenseResult) {
    const expTags = (biggestExpenseResult.tags ?? []) as Array<{ path: string }>;
    biggestExpense = {
      amount: biggestExpenseResult.amount,
      where: biggestExpenseResult.where,
      date: biggestExpenseResult.date.toISOString(),
      tagNames: expTags.map((t) => t.path).join(", ") || "Untagged",
      paidBy: biggestExpenseResult.paidBy,
    };
  }

  const topMerchant = topMerchantAgg.length > 0
    ? { where: topMerchantAgg[0]._id, count: topMerchantAgg[0].count, total: topMerchantAgg[0].total }
    : null;

  let busiestMonth: { month: number; year: number; total: number } | null = null;
  for (const m of monthlyTotals) {
    if (m.total > 0 && (!busiestMonth || m.total > busiestMonth.total)) {
      busiestMonth = { month: m.month, year: m.year, total: m.total };
    }
  }

  return { biggestExpense, topMerchant, busiestMonth };
}
