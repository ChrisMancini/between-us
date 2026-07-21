"use client";

import type { SettlementExpenseRow } from "@/lib/settlement-calc";
import { formatCurrency } from "@/lib/utils";
import { usePersons } from "@/components/persons-context";
import { ExpenseRow } from "@/app/(dashboard)/expenses/_components/expense-row";
import { ExpenseCard } from "@/app/(dashboard)/expenses/_components/expense-card";

const noop = () => {};

export function ExpenseTable({
  expenses,
  title,
  description,
  muted = false,
}: {
  expenses: SettlementExpenseRow[];
  title: string;
  description: string;
  muted?: boolean;
}) {
  const { personMap } = usePersons();
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

      {/* Desktop table */}
      <table className="hidden sm:table w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Date</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Where</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Tags</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Paid by</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Split</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Amount</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {expenses.map((e) => (
            <ExpenseRow
              key={e._id}
              expense={e}
              isSettled
              bulkEditMode={false}
              isSelected={false}
              onToggleSelection={noop}
              onDelete={noop}
              personMap={personMap}
            />
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-border">
        {expenses.map((e) => (
          <ExpenseCard
            key={e._id}
            expense={e}
            isSettled
            bulkEditMode={false}
            isSelected={false}
            onToggleSelection={noop}
            onDelete={noop}
            personMap={personMap}
          />
        ))}
      </div>
    </div>
  );
}
