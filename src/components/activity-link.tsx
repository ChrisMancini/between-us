"use client";

import { useState, useRef } from "react";
import { TrendingDown, TrendingUp, CalendarDays } from "lucide-react";
import { ExpenseDetailContent } from "@/components/expense-detail-popover";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import { formatCurrency, formatMonthYear, formatShortDate } from "@/lib/utils";
import type { SerializedActivity } from "@/lib/models/activity";
import type { SerializedExpense } from "@/lib/models/expense";
import type { SerializedSettlement } from "@/lib/models/settlement";

interface ActivityLinkProps {
  children: React.ReactNode;
  activity: SerializedActivity;
}

const LINKABLE_ACTIONS = ["expense_create", "expense_edit", "settlement_close", "settlement_reopen"] as const;

interface FetchConfig {
  dataUrl: string;
  validateUrl: string;
}

function extractFetchConfig(action: string, metadata: Record<string, unknown>): FetchConfig | null {
  switch (action) {
    case "expense_create":
    case "expense_edit": {
      const expenseId = metadata.expenseId;
      if (typeof expenseId !== "string" || !expenseId) return null;
      return {
        dataUrl: `/api/expenses/${expenseId}`,
        validateUrl: `/api/expenses/${expenseId}`,
      };
    }
    case "settlement_close":
    case "settlement_reopen": {
      const month = metadata.month;
      const year = metadata.year;
      if (typeof month !== "number" || typeof year !== "number" || month < 1 || month > 12) return null;
      return {
        dataUrl: `/api/settlement/validate?month=${month}&year=${year}`,
        validateUrl: `/api/settlement/validate?month=${month}&year=${year}`,
      };
    }
    default:
      return null;
  }
}

export function ActivityLink({ children, activity }: ActivityLinkProps) {
  const isLinkable = LINKABLE_ACTIONS.includes(activity.action as (typeof LINKABLE_ACTIONS)[number]);

  if (!isLinkable) {
    return <>{children}</>;
  }

  if (activity.action === "expense_create" || activity.action === "expense_edit") {
    return <ActivityExpensePopover activity={activity}>{children}</ActivityExpensePopover>;
  }

  if (activity.action === "settlement_close" || activity.action === "settlement_reopen") {
    return <ActivitySettlementPopover activity={activity}>{children}</ActivitySettlementPopover>;
  }

  return <>{children}</>;
}

function ActivityExpensePopover({
  children,
  activity,
}: {
  children: React.ReactNode;
  activity: SerializedActivity;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expenseData, setExpenseData] = useState<SerializedExpense | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const config = extractFetchConfig(activity.action, activity.metadata);
  if (!config) return <>{children}</>;

  const handleClick = async (e: React.MouseEvent) => {
    setPosition({
      x: e.clientX,
      y: e.clientY,
    });

    setIsOpen(true);
    setIsLoading(true);
    setError(null);
    setExpenseData(null);

    try {
      const res = await fetch(config.dataUrl);

      if (res.status === 404) {
        setError("Expense not found");
        setIsLoading(false);
        return;
      }

      if (res.status === 403) {
        setError("You don't have access to this expense");
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        setError("Unable to load expense details");
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      if ("expense" in data) {
        setExpenseData(data.expense);
      }
    } catch (err) {
      console.error("[ActivityLink] Error loading expense:", err);
      setError("Unable to load expense details");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleClick}
        className="w-full text-left hover:bg-muted/60 transition-colors cursor-pointer"
      >
        {children}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-50 w-[300px] bg-popover border border-popover-border rounded-md shadow-md"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
            }}
          >
            {isLoading ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Loading details...</p>
              </div>
            ) : error ? (
              <div className="px-4 py-4 text-center">
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : expenseData ? (
              <ExpenseDetailInPopover expense={expenseData} />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function ActivitySettlementPopover({
  children,
  activity,
}: {
  children: React.ReactNode;
  activity: SerializedActivity;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settlementData, setSettlementData] = useState<SerializedSettlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const config = extractFetchConfig(activity.action, activity.metadata);
  if (!config) return <>{children}</>;

  const handleClick = async (e: React.MouseEvent) => {
    setPosition({
      x: e.clientX,
      y: e.clientY,
    });

    setIsOpen(true);
    setIsLoading(true);
    setError(null);
    setSettlementData(null);

    try {
      const res = await fetch(config.dataUrl);

      if (res.status === 404) {
        setError("Settlement not found");
        setIsLoading(false);
        return;
      }

      if (res.status === 403) {
        setError("You don't have access to this settlement");
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        setError("Unable to load settlement details");
        setIsLoading(false);
        return;
      }

      const month = activity.metadata.month as number;
      const year = activity.metadata.year as number;
      const settlementRes = await fetch(`/api/settlement?month=${month}&year=${year}`);
      if (settlementRes.ok) {
        const data = await settlementRes.json();
        setSettlementData(data.settlement);
      } else {
        setError("Unable to load settlement details");
      }
    } catch (err) {
      console.error("[ActivityLink] Error loading settlement:", err);
      setError("Unable to load settlement details");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleClick}
        className="w-full text-left hover:bg-muted/60 transition-colors cursor-pointer"
      >
        {children}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="fixed z-50 w-[300px] bg-popover border border-popover-border rounded-md shadow-md"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
            }}
          >
            {isLoading ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Loading details...</p>
              </div>
            ) : error ? (
              <div className="px-4 py-4 text-center">
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : settlementData ? (
              <SettlementDetailContent settlement={settlementData} activity={activity} />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function ExpenseDetailInPopover({ expense }: { expense: SerializedExpense }) {
  return (
    <ExpenseDetailContent
      date={expense.date}
      where={expense.where}
      paidBy={expense.paidBy}
      amount={expense.amount}
      tags={expense.tags.map((t) => t.path).join(", ")}
      splitType={expense.splitType}
      settlementType={expense.settlementType}
      notes={expense.notes}
    />
  );
}

function SettlementDetailContent({
  settlement,
  activity,
}: {
  settlement: SerializedSettlement;
  activity: SerializedActivity;
}) {
  const { personMap } = usePersons();
  const { month, year, totalOwed, owedBy, owedTo, closedAt, note } = settlement;
  const person1OwesPerson2 = owedBy === "person1" ? totalOwed : 0;
  const person2OwesPerson1 = owedBy === "person2" ? totalOwed : 0;
  const payer = personMap.get(owedBy)?.displayName ?? owedBy;
  const receiver = personMap.get(owedTo)?.displayName ?? owedTo;

  return (
    <>
      {/* Header */}
      <div className="border-b border-primary/10 bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{formatMonthYear(month, year)}</p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {formatCurrency(totalOwed)}
          </p>
        </div>
        {closedAt && (
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatShortDate(closedAt, { omitCurrentYear: true })}
            </span>
            <PersonBadge {...badgeProps(activity.actorKey, personMap)} />
          </div>
        )}
      </div>

      {/* Net Settlement Amount */}
      <div className="px-4 py-3 border-b border-primary/10">
        <div className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/70 mb-1">
            Net Settlement
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {formatCurrency(totalOwed)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{payer}</span> owes{" "}
          <span className="font-medium text-foreground">{receiver}</span>
        </p>
      </div>

      {/* Direction Breakdown */}
      <div className="px-4 py-3 space-y-2.5 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-primary/70" />
            <span className="font-medium">{receiver} ← {payer}</span>
          </div>
          <span className="text-sm font-bold tabular-nums">{formatCurrency(person1OwesPerson2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingDown className="h-3 w-3 text-violet-600 dark:text-violet-400" />
            <span className="font-medium">{payer} ← {receiver}</span>
          </div>
          <span className="text-sm font-bold tabular-nums">{formatCurrency(person2OwesPerson1)}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="border-t border-primary/10 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1.5">
          Notes
        </p>
        {note ? (
          <p className="text-sm text-foreground whitespace-pre-wrap">{note}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">No notes</p>
        )}
      </div>
    </>
  );
}
