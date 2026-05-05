"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { PERSON_COLORS, badgeProps } from "@/lib/person-utils";
import type { ExpenseDetail } from "../page";

interface CategoryTotal {
  categoryName: string;
  settlementType: "immediate" | "deferred";
  person1Paid: number;
  person2Paid: number;
  total: number;
}

interface PersonCategoryMatrixProps {
  categories: CategoryTotal[];
  expensesByCategory: Record<string, ExpenseDetail[]>;
}

export function PersonCategoryMatrix({
  categories,
  expensesByCategory,
}: PersonCategoryMatrixProps) {
  const deferred = categories.filter((c) => c.settlementType === "deferred");
  const immediate = categories.filter((c) => c.settlementType === "immediate");

  return (
    <div className="space-y-4">
      <MatrixTable
        title="Settled Monthly"
        description="Who paid what in each category. Click a row to see details."
        categories={deferred}
        expensesByCategory={expensesByCategory}
      />
      {immediate.length > 0 && (
        <MatrixTable
          title="Settled Immediately"
          description="Direct payments by category. Click a row to see details."
          categories={immediate}
          expensesByCategory={expensesByCategory}
          muted
        />
      )}
    </div>
  );
}

function MatrixTable({
  title,
  description,
  categories,
  expensesByCategory,
  muted = false,
}: {
  title: string;
  description: string;
  categories: CategoryTotal[];
  expensesByCategory: Record<string, ExpenseDetail[]>;
  muted?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (categories.length === 0) {
    return null;
  }

  function toggle(categoryName: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  }

  const { persons, personMap } = usePersons();
  const person1Sum = categories.reduce((s, c) => s + c.person1Paid, 0);
  const person2Sum = categories.reduce((s, c) => s + c.person2Paid, 0);
  const grandTotal = categories.reduce((s, c) => s + c.total, 0);

  return (
    <div
      className={`rounded-xl border overflow-hidden shadow-sm bg-card ${muted ? "border-border opacity-70" : "border-primary/10"}`}
    >
      <div
        className={`border-b px-5 py-3 flex items-center justify-between ${muted ? "border-border bg-muted/60" : "border-primary/10 bg-primary/5"}`}
      >
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${muted ? "text-muted-foreground" : "text-primary/70"}`}
          >
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 w-6" />
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Category
            </th>
            <th className={`text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide ${PERSON_COLORS[persons[0].colorIndex].chartLabel}`}>
              {persons[0].displayName}
            </th>
            <th className={`text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide ${PERSON_COLORS[persons[1].colorIndex].chartLabel}`}>
              {persons[1].displayName}
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => {
            const isOpen = expanded.has(cat.categoryName);
            const expenses = expensesByCategory[cat.categoryName] ?? [];

            return (
              <CategoryRow
                key={cat.categoryName}
                cat={cat}
                isOpen={isOpen}
                expenses={expenses}
                onToggle={() => toggle(cat.categoryName)}
              />
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/50">
            <td />
            <td className="px-4 py-2.5 font-semibold">Total</td>
            <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${PERSON_COLORS[persons[0].colorIndex].accent}`}>
              {formatCurrency(person1Sum)}
            </td>
            <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${PERSON_COLORS[persons[1].colorIndex].accent}`}>
              {formatCurrency(person2Sum)}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums">
              {formatCurrency(grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CategoryRow({
  cat,
  isOpen,
  expenses,
  onToggle,
}: {
  cat: CategoryTotal;
  isOpen: boolean;
  expenses: ExpenseDetail[];
  onToggle: () => void;
}) {
  const { persons, personMap } = usePersons();
  return (
    <>
      <tr
        className="border-t border-border hover:bg-muted/60 transition-colors cursor-pointer select-none"
        onClick={onToggle}
      >
        <td className="pl-4 py-2.5 w-6">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              isOpen && "rotate-90"
            )}
          />
        </td>
        <td className="px-4 py-2.5 font-medium">{cat.categoryName}</td>
        <td className={`px-4 py-2.5 text-right tabular-nums ${PERSON_COLORS[persons[0].colorIndex].accent}`}>
          {formatCurrency(cat.person1Paid)}
        </td>
        <td className={`px-4 py-2.5 text-right tabular-nums ${PERSON_COLORS[persons[1].colorIndex].accent}`}>
          {formatCurrency(cat.person2Paid)}
        </td>
        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
          {formatCurrency(cat.total)}
        </td>
      </tr>
      {isOpen && expenses.length > 0 && (
        <tr>
          <td colSpan={5} className="p-0">
            <div className="bg-muted/50 border-y border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left px-6 py-1.5 font-semibold uppercase tracking-wide text-muted-foreground/50">
                      Date
                    </th>
                    <th className="text-left px-3 py-1.5 font-semibold uppercase tracking-wide text-muted-foreground/50">
                      Where
                    </th>
                    <th className="text-left px-3 py-1.5 font-semibold uppercase tracking-wide text-muted-foreground/50">
                      Notes
                    </th>
                    <th className="text-left px-3 py-1.5 font-semibold uppercase tracking-wide text-muted-foreground/50">
                      Paid By
                    </th>
                    <th className="text-left px-3 py-1.5 font-semibold uppercase tracking-wide text-muted-foreground/50">
                      Split
                    </th>
                    <th className="text-right px-6 py-1.5 font-semibold uppercase tracking-wide text-muted-foreground/50">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {expenses.map((e, i) => (
                    <tr key={i} className="hover:bg-background/60 transition-colors">
                      <td className="px-6 py-1.5 text-muted-foreground whitespace-nowrap">
                        {new Date(e.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-foreground">
                        {e.where}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {e.notes || "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <PersonBadge {...badgeProps(e.paidBy, personMap)} />
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {e.splitType === "split" ? "50/50" : "Full"}
                      </td>
                      <td className="px-6 py-1.5 text-right font-semibold tabular-nums">
                        {formatCurrency(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
