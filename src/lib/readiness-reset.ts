import { MonthReadiness } from "@/lib/models/month-readiness";

export async function resetReadinessForMonths(
  personKey: string,
  dates: (Date | string)[]
): Promise<void> {
  try {
    const seen = new Set<string>();
    const pairs: { month: number; year: number }[] = [];

    for (const d of dates) {
      const dt = typeof d === "string" ? new Date(d) : d;
      const month = dt.getUTCMonth() + 1;
      const year = dt.getUTCFullYear();
      const key = `${year}-${month}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ month, year });
      }
    }

    if (pairs.length === 0) return;

    await MonthReadiness.updateMany(
      { $or: pairs, doneBy: personKey },
      { $pull: { doneBy: personKey } }
    );
  } catch (err) {
    console.error("[resetReadinessForMonths] Failed:", err);
  }
}
