"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { SerializedExpense } from "@/lib/models/expense";
import type { SerializedTag } from "@/lib/models/tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import { EditExpenseDialog } from "./edit-expense-dialog";
import { DeleteDialog } from "@/components/delete-dialog";

function formatAmount(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface ExpenseListProps {
  expenses: SerializedExpense[];
  closedMonths: Set<string>;
  isFiltered?: boolean;
  currentUserKey?: string;
  tags?: SerializedTag[];
  closedMonthsList?: string[];
}

export function ExpenseList({
  expenses,
  closedMonths,
  isFiltered = false,
  currentUserKey,
  tags,
  closedMonthsList,
}: ExpenseListProps) {
  const { personMap } = usePersons();
  const [deleteTarget, setDeleteTarget] = useState<SerializedExpense | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary/20 bg-card py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {isFiltered
            ? "No expenses match your filters."
            : "No expenses yet. Add your first one above."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/10 bg-card overflow-hidden shadow-sm">
      <div className="border-b border-primary/10 bg-primary/5 px-4 py-2.5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Expenses
        </p>
        <p className="text-xs text-muted-foreground">
          {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Date</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Where</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Tags</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Paid by</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Split</th>
            <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Amount</th>
            {currentUserKey && <th className="w-20" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {expenses.map((e) => {
            const d = new Date(e.date);
            const isSettled = closedMonths.has(
              `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
            );
            return (
            <tr key={e._id} className="hover:bg-primary/5 transition-colors">
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {formatDate(e.date)}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                <span className="flex items-center gap-2">
                  {e.where}
                  {isSettled && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400 font-medium leading-4"
                    >
                      Settled
                    </Badge>
                  )}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {e.tags.map((t) => t.path).join(", ")}
              </td>
              <td className="px-4 py-3">
                <PersonBadge {...badgeProps(e.paidBy, personMap)} />
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {e.splitType === "split" ? "50 / 50" : "Full"}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                {formatAmount(e.amount)}
              </td>
              {currentUserKey && (
                <td className="px-2 py-3">
                  {!isSettled && e.paidBy === currentUserKey && (
                    <div className="flex items-center gap-0.5">
                      <EditExpenseDialog
                        expense={e}
                        tags={tags!}
                        closedMonths={closedMonthsList!}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>

      {deleteTarget && (
        <DeleteDialog
          endpoint={`/api/expenses/${deleteTarget._id}`}
          itemType="expense"
          itemLabel={deleteTarget.where}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}
