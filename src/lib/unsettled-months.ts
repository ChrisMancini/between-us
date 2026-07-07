import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { MonthReadiness } from "@/lib/models/month-readiness";
import type { MonthYear } from "@/lib/escalation-tiers";

export async function getUnsettledMonthsForUser(
  userKey: string
): Promise<MonthYear[]> {
  await connectToDatabase();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [expenseMonths, closedSettlements, readinessRecords] =
    await Promise.all([
      Expense.aggregate<{ _id: { month: number; year: number } }>([
        {
          $match: {
            date: {
              $lt: new Date(Date.UTC(currentYear, currentMonth - 1, 1)),
            },
          },
        },
        {
          $group: {
            _id: {
              month: { $month: "$date" },
              year: { $year: "$date" },
            },
          },
        },
      ]),
      Settlement.find(
        { status: "closed" },
        { month: 1, year: 1, _id: 0 }
      ).lean(),
      MonthReadiness.find({}, { month: 1, year: 1, doneBy: 1, _id: 0 }).lean(),
    ]);

  const closedSet = new Set(
    closedSettlements.map((s) => `${s.year}-${s.month}`)
  );

  const readinessMap = new Map(
    readinessRecords.map((r) => [`${r.year}-${r.month}`, r.doneBy as string[]])
  );

  return expenseMonths
    .map((e) => e._id)
    .filter((m) => {
      const key = `${m.year}-${m.month}`;
      if (closedSet.has(key)) return false;
      const doneBy = readinessMap.get(key);
      if (doneBy && doneBy.includes(userKey)) return false;
      return true;
    })
    .sort((a, b) => a.year - b.year || a.month - b.month);
}
