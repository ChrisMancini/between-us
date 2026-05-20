"use client";

import { Trophy, MapPin, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";

export interface BiggestExpense {
  amount: number;
  where: string;
  date: string;
  tagNames: string;
  paidBy: string;
}

export interface TopMerchant {
  where: string;
  count: number;
  total: number;
}

export interface BusiestMonth {
  month: number;
  year: number;
  total: number;
}

interface AnnualHighlightsProps {
  biggestExpense: BiggestExpense | null;
  topMerchant: TopMerchant | null;
  busiestMonth: BusiestMonth | null;
}

function monthName(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
  });
}

export function AnnualHighlights({
  biggestExpense,
  topMerchant,
  busiestMonth,
}: AnnualHighlightsProps) {
  const { personMap } = usePersons();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Biggest Expense */}
      <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-primary/10 bg-primary/5 px-4 py-2.5 flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-primary/70" />
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
            Biggest Expense
          </p>
        </div>
        <div className="px-4 py-4">
          {biggestExpense ? (
            <>
              <p className="text-2xl font-bold">
                {formatCurrency(biggestExpense.amount)}
              </p>
              <p className="text-sm font-medium mt-1">
                {biggestExpense.where}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <span>{biggestExpense.tagNames}</span>
                <span>·</span>
                <span>
                  {new Date(biggestExpense.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                <span>·</span>
                <PersonBadge
                  {...badgeProps(biggestExpense.paidBy, personMap)}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No expenses</p>
          )}
        </div>
      </div>

      {/* Most Frequent Merchant */}
      <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-primary/10 bg-primary/5 px-4 py-2.5 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-primary/70" />
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
            Most Frequent Merchant
          </p>
        </div>
        <div className="px-4 py-4">
          {topMerchant ? (
            <>
              <p className="text-2xl font-bold">{topMerchant.where}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {topMerchant.count} visit{topMerchant.count !== 1 ? "s" : ""} ·{" "}
                {formatCurrency(topMerchant.total)} total
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No expenses</p>
          )}
        </div>
      </div>

      {/* Busiest Month */}
      <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-primary/10 bg-primary/5 px-4 py-2.5 flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-primary/70" />
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
            Busiest Month
          </p>
        </div>
        <div className="px-4 py-4">
          {busiestMonth ? (
            <>
              <p className="text-2xl font-bold">
                {monthName(busiestMonth.month, busiestMonth.year)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatCurrency(busiestMonth.total)} in spending
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No expenses</p>
          )}
        </div>
      </div>
    </div>
  );
}
