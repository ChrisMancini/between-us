import { PersonBadge } from "@/components/person-badge";
import { ExpenseDetailPopover } from "@/components/expense-detail-popover";
import type { SerializedPerson } from "@/lib/models/person";
import type { SettlementExpenseRow } from "@/lib/settlement-calc";
import { formatCurrency } from "@/lib/utils";
import { badgeProps } from "@/lib/persons";

export function ExpenseTable({
  expenses,
  title,
  description,
  muted = false,
  personMap,
}: {
  expenses: SettlementExpenseRow[];
  title: string;
  description: string;
  muted?: boolean;
  personMap: Map<string, SerializedPerson>;
}) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className={`rounded-xl border overflow-hidden shadow-sm ${muted ? "border-border opacity-70" : "border-primary/10"} bg-card`}>
      <div className={`border-b px-5 py-3 flex items-center justify-between ${muted ? "border-border bg-muted/60" : "border-primary/10 bg-primary/5"}`}>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${muted ? "text-muted-foreground" : "text-primary/70"}`}>
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(total)}
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Date</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Where</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Tags</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Paid by</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Split</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Amount</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {expenses.map((e) => (
            <tr key={e._id} className="hover:bg-muted/60 transition-colors">
              <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                {new Date(e.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </td>
              <td className="px-4 py-2.5 font-medium text-foreground">{e.where}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{e.tags.map((t) => t.path).join(", ")}</td>
              <td className="px-4 py-2.5">
                <PersonBadge {...badgeProps(e.paidBy, personMap)} />
              </td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">
                {e.splitType === "split" ? "50 / 50" : "Full"}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                {formatCurrency(e.amount)}
              </td>
              <td className="px-2 py-2.5">
                <ExpenseDetailPopover
                  date={e.date}
                  where={e.where}
                  paidBy={e.paidBy}
                  amount={e.amount}
                  tags={e.tags.map((t) => t.path).join(", ")}
                  splitType={e.splitType}
                  settlementType={e.settlementType}
                  notes={e.notes}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
