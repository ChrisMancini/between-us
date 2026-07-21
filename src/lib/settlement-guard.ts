import { NextResponse } from "next/server";
import { Settlement } from "@/lib/models/settlement";
import { formatMonthYear } from "@/lib/utils";

async function findSettledMonths(
  dates: (Date | string)[]
): Promise<{ month: number; year: number }[]> {
  const seen = new Set<string>();
  const monthYearPairs: { month: number; year: number }[] = [];

  for (const d of dates) {
    const date = typeof d === "string" ? new Date(d) : d;
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();
    const key = `${year}-${month}`;
    if (!seen.has(key)) {
      seen.add(key);
      monthYearPairs.push({ month, year });
    }
  }

  const closedSettlements = await Settlement.find({
    $or: monthYearPairs.map(({ month, year }) => ({
      month,
      year,
      status: { $ne: "open" },
    })),
  }).lean();

  return closedSettlements.map((s) => ({ month: s.month, year: s.year }));
}

/**
 * Plain predicate for callers that have no HTTP response to return (e.g. the
 * background auto-apply runner): true if any of the given dates falls in a settled
 * month.
 */
export async function areMonthsSettled(
  dates: (Date | string)[]
): Promise<boolean> {
  return (await findSettledMonths(dates)).length > 0;
}

export async function assertMonthsOpen(
  dates: (Date | string)[]
): Promise<NextResponse | null> {
  const closedSettlements = await findSettledMonths(dates);

  if (closedSettlements.length === 0) return null;

  const labels = closedSettlements.map((s) =>
    formatMonthYear(s.month, s.year, { omitCurrentYear: false })
  );

  const error =
    labels.length === 1
      ? `${labels[0]} has already been settled. Reopen the month first.`
      : `Cannot import into settled months: ${labels.join(", ")}. Reopen the month first.`;

  return NextResponse.json({ error }, { status: 422 });
}
