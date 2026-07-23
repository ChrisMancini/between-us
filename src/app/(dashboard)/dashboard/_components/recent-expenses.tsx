"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { LiveRegion } from "@/components/a11y/live-region";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import { ExpenseDetailPopover } from "@/components/expense-detail-popover";

interface RecentExpense {
  date: string;
  where: string;
  tagNames: string;
  paidBy: string;
  amount: number;
  notes?: string;
  splitType: "split" | "full";
  settlementType: "immediate" | "deferred";
}

interface RecentExpensesProps {
  expenses: RecentExpense[];
}

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  const { personMap } = usePersons();

  return (
    <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Recent Expenses
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="py-10 text-center">
          <LiveRegion visible className="text-sm text-muted-foreground">No expenses yet.</LiveRegion>
        </div>
      ) : (
        <table className="hidden sm:table w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Date
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Where
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Tags
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Paid by
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Amount
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {expenses.map((e, i) => (
              <tr key={i} className="hover:bg-muted/60 transition-colors">
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                  {new Date(e.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </td>
                <td className="px-4 py-2.5 font-medium text-foreground">
                  {e.where}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {e.tagNames}
                </td>
                <td className="px-4 py-2.5">
                  <PersonBadge {...badgeProps(e.paidBy, personMap)} />
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
                    tags={e.tagNames}
                    splitType={e.splitType}
                    settlementType={e.settlementType}
                    notes={e.notes}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Mobile cards — shown below sm */}
      {expenses.length > 0 && (
        <div className="sm:hidden divide-y divide-border">
          {expenses.map((e, i) => (
            <div key={i} className="flex items-start gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-foreground">
                    {e.where}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">
                    {formatCurrency(e.amount)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </span>
                  <PersonBadge {...badgeProps(e.paidBy, personMap)} />
                </div>
                {e.tagNames && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {e.tagNames}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <ExpenseDetailPopover
                  date={e.date}
                  where={e.where}
                  paidBy={e.paidBy}
                  amount={e.amount}
                  tags={e.tagNames}
                  splitType={e.splitType}
                  settlementType={e.settlementType}
                  notes={e.notes}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border px-4 py-2.5">
        <Link
          href="/expenses"
          className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View all expenses
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
