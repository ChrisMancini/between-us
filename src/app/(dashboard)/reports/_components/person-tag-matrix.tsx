"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { PERSON_COLORS, badgeProps } from "@/lib/person-utils";
import type { ExpenseDetail } from "../page";

interface TagTotal {
  tagPath: string;
  tagName: string;
  settlementType: "immediate" | "deferred";
  person1Paid: number;
  person2Paid: number;
  total: number;
}

interface PersonTagMatrixProps {
  tags: TagTotal[];
  expensesByTag: Record<string, ExpenseDetail[]>;
}

export function PersonTagMatrix({
  tags,
  expensesByTag,
}: PersonTagMatrixProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <MatrixTable
      title="By Tag"
      description="Who paid what per tag. Click a row to see details."
      tags={tags}
      expensesByTag={expensesByTag}
    />
  );
}

function MatrixTable({
  title,
  description,
  tags,
  expensesByTag,
}: {
  title: string;
  description: string;
  tags: TagTotal[];
  expensesByTag: Record<string, ExpenseDetail[]>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { persons } = usePersons();

  function toggle(tagPath: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tagPath)) {
        next.delete(tagPath);
      } else {
        next.add(tagPath);
      }
      return next;
    });
  }

  const person1Sum = tags.reduce((s, t) => s + t.person1Paid, 0);
  const person2Sum = tags.reduce((s, t) => s + t.person2Paid, 0);
  const grandTotal = tags.reduce((s, t) => s + t.total, 0);

  return (
    <div className="rounded-xl border border-primary/10 overflow-hidden shadow-sm bg-card">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
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
              Tag
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
          {tags.map((tag) => {
            const isOpen = expanded.has(tag.tagPath);
            const expenses = expensesByTag[tag.tagPath] ?? [];

            return (
              <TagRow
                key={tag.tagPath}
                tag={tag}
                isOpen={isOpen}
                expenses={expenses}
                onToggle={() => toggle(tag.tagPath)}
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

function TagRow({
  tag,
  isOpen,
  expenses,
  onToggle,
}: {
  tag: TagTotal;
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
        <td className="px-4 py-2.5 font-medium">{tag.tagPath}</td>
        <td className={`px-4 py-2.5 text-right tabular-nums ${PERSON_COLORS[persons[0].colorIndex].accent}`}>
          {formatCurrency(tag.person1Paid)}
        </td>
        <td className={`px-4 py-2.5 text-right tabular-nums ${PERSON_COLORS[persons[1].colorIndex].accent}`}>
          {formatCurrency(tag.person2Paid)}
        </td>
        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
          {formatCurrency(tag.total)}
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
                        {e.notes || "---"}
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
