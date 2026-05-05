import { NextResponse } from "next/server";
import { Settlement } from "@/lib/models/settlement";

function formatMonthLabel(month: number, year: number): string {
  return new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export async function assertMonthsOpen(
  dates: (Date | string)[]
): Promise<NextResponse | null> {
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

  if (closedSettlements.length === 0) return null;

  const labels = closedSettlements.map((s) =>
    formatMonthLabel(s.month, s.year)
  );

  const error =
    labels.length === 1
      ? `${labels[0]} has already been settled. Reopen the month first.`
      : `Cannot import into settled months: ${labels.join(", ")}. Reopen the month first.`;

  return NextResponse.json({ error }, { status: 422 });
}
