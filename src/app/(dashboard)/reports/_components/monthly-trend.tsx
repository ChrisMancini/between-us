import { formatCurrency } from "@/lib/utils";

interface MonthlyTotal {
  month: number;
  year: number;
  deferredTotal: number;
  immediateTotal: number;
  total: number;
}

interface MonthlyTrendProps {
  months: MonthlyTotal[];
  selectedMonth: number;
  selectedYear: number;
}

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function MonthlyTrend({
  months,
  selectedMonth,
  selectedYear,
}: MonthlyTrendProps) {
  if (months.length === 0) return null;

  const maxTotal = Math.max(...months.map((m) => m.total), 1);

  return (
    <div className="rounded-xl border border-primary/10 overflow-hidden shadow-sm bg-card">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Monthly Trend
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Spending over the last {months.length} months.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[34rem]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Month
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Monthly
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Immediate
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Total
            </th>
            <th className="px-4 py-2.5 w-40" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {months.map((m) => {
            const isSelected =
              m.month === selectedMonth && m.year === selectedYear;
            const pct = (m.total / maxTotal) * 100;

            return (
              <tr
                key={`${m.year}-${m.month}`}
                className={
                  isSelected
                    ? "bg-primary/5 font-semibold"
                    : "hover:bg-muted/60 transition-colors"
                }
              >
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {monthLabel(m.month, m.year)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCurrency(m.deferredTotal)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {formatCurrency(m.immediateTotal)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                  {formatCurrency(m.total)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isSelected ? "bg-primary/60" : "bg-primary/25"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
}
