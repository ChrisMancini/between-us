export interface DuplicateMatch {
  date: string;
  amount: number;
  where: string;
}

export async function checkDuplicateExpenses(
  date: string,
  amountCents: number,
  excludeId?: string
): Promise<DuplicateMatch[]> {
  try {
    const params = new URLSearchParams({ startDate: date, endDate: date });
    if (excludeId) params.set("excludeId", excludeId);
    const res = await fetch(`/api/expenses/check-duplicates?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.expenses as DuplicateMatch[]).filter(
      (e) => e.amount === amountCents
    );
  } catch {
    return [];
  }
}

export function buildDuplicateMap(
  expenses: DuplicateMatch[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of expenses) {
    const dateKey = e.date.split("T")[0];
    const key = `${dateKey}|${e.amount}`;
    map.set(key, e.where);
  }
  return map;
}
