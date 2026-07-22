"use client";

import { useState, useRef, useLayoutEffect } from "react";
import {
  TrendingDown,
  TrendingUp,
  CalendarDays,
  CalendarClock,
  Repeat,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { ExpenseDetailContent } from "@/components/expense-detail-popover";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import { formatCurrency, formatMonthYear, formatShortDate } from "@/lib/utils";
import { parseApplySummary } from "@/lib/activity-apply-summary";
import type { SerializedActivity } from "@/lib/models/activity";
import type { SerializedExpense } from "@/lib/models/expense";
import type { SerializedSettlement } from "@/lib/models/settlement";

function clampToViewport(el: HTMLDivElement, clickX: number, clickY: number) {
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const { width, height } = el.getBoundingClientRect();

  let x = clickX;
  let y = clickY;

  if (x + width > vw - margin) x = vw - width - margin;
  if (y + height > vh - margin) y = vh - height - margin;
  if (x < margin) x = margin;
  if (y < margin) y = margin;

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

interface ActivityLinkProps {
  children: React.ReactNode;
  activity: SerializedActivity;
}

const LINKABLE_ACTIONS = [
  "expense_create",
  "expense_edit",
  "settlement_close",
  "settlement_reopen",
  "recurring_apply",
  "recurring_auto_apply",
] as const;

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

  if (activity.action === "recurring_apply" || activity.action === "recurring_auto_apply") {
    return <ActivityApplyPopover activity={activity}>{children}</ActivityApplyPopover>;
  }

  return <>{children}</>;
}

/** A centered status line (loading / error) for the fetch-backed popovers. */
function PopoverMessage({ message, loading }: { message: string; loading?: boolean }) {
  return (
    <div className={`px-4 ${loading ? "py-8" : "py-4"} text-center`}>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Shared chrome for every activity popover: a full-width trigger button, a
 * click-anchored, viewport-clamped panel, and a click-away overlay. `onOpen` runs
 * when it opens (used by the fetch-backed popovers to load their data); `renderBody`
 * supplies the panel contents. The panel re-clamps whenever its size changes (e.g.
 * a loading state resolving to loaded content).
 */
function PositionedActivityPopover({
  children,
  onOpen,
  renderBody,
}: {
  children: React.ReactNode;
  onOpen?: () => void;
  renderBody: () => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!isOpen || !el) return;
    clampToViewport(el, position.x, position.y);
    const observer = new ResizeObserver(() =>
      clampToViewport(el, position.x, position.y)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen, position]);

  const handleClick = (e: React.MouseEvent) => {
    setPosition({ x: e.clientX, y: e.clientY });
    setIsOpen(true);
    onOpen?.();
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="focus-ring-inset w-full text-left hover:bg-muted/60 transition-colors cursor-pointer"
      >
        {children}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            ref={popoverRef}
            className="fixed z-50 w-[300px] max-w-[calc(100vw-16px)] bg-popover border border-popover-border rounded-md shadow-md"
          >
            {renderBody()}
          </div>
        </>
      )}
    </div>
  );
}

function ActivityExpensePopover({
  children,
  activity,
}: {
  children: React.ReactNode;
  activity: SerializedActivity;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [expenseData, setExpenseData] = useState<SerializedExpense | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config = extractFetchConfig(activity.action, activity.metadata);
  if (!config) return <>{children}</>;

  const load = async () => {
    setIsLoading(true);
    setError(null);
    setExpenseData(null);
    try {
      const res = await fetch(config.dataUrl);
      if (res.status === 404) {
        setError("Expense not found");
        return;
      }
      if (res.status === 403) {
        setError("You don't have access to this expense");
        return;
      }
      if (!res.ok) {
        setError("Unable to load expense details");
        return;
      }
      const data = await res.json();
      if ("expense" in data) setExpenseData(data.expense);
    } catch (err) {
      console.error("[ActivityLink] Error loading expense:", err);
      setError("Unable to load expense details");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PositionedActivityPopover
      onOpen={load}
      renderBody={() =>
        isLoading ? (
          <PopoverMessage message="Loading details..." loading />
        ) : error ? (
          <PopoverMessage message={error} />
        ) : expenseData ? (
          <ExpenseDetailInPopover expense={expenseData} />
        ) : null
      }
    >
      {children}
    </PositionedActivityPopover>
  );
}

function ActivitySettlementPopover({
  children,
  activity,
}: {
  children: React.ReactNode;
  activity: SerializedActivity;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [settlementData, setSettlementData] = useState<SerializedSettlement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config = extractFetchConfig(activity.action, activity.metadata);
  if (!config) return <>{children}</>;

  const load = async () => {
    setIsLoading(true);
    setError(null);
    setSettlementData(null);
    try {
      const res = await fetch(config.dataUrl);
      if (res.status === 404) {
        setError("Settlement not found");
        return;
      }
      if (res.status === 403) {
        setError("You don't have access to this settlement");
        return;
      }
      if (!res.ok) {
        setError("Unable to load settlement details");
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
    <PositionedActivityPopover
      onOpen={load}
      renderBody={() =>
        isLoading ? (
          <PopoverMessage message="Loading details..." loading />
        ) : error ? (
          <PopoverMessage message={error} />
        ) : settlementData ? (
          <SettlementDetailContent settlement={settlementData} activity={activity} />
        ) : null
      }
    >
      {children}
    </PositionedActivityPopover>
  );
}

/**
 * Popover for a template-apply entry (manual or scheduled). Unlike the expense and
 * settlement popovers this needs no fetch — the run's consolidated summary already
 * lives in the activity metadata, so it renders straight from `activity`.
 */
function ActivityApplyPopover({
  children,
  activity,
}: {
  children: React.ReactNode;
  activity: SerializedActivity;
}) {
  return (
    <PositionedActivityPopover
      renderBody={() => <ApplyDetailContent activity={activity} />}
    >
      {children}
    </PositionedActivityPopover>
  );
}

function formatApplyDate(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function ApplyDetailContent({ activity }: { activity: SerializedActivity }) {
  const { personMap } = usePersons();
  const { templateName, date, addedCount, duplicates, flagged } =
    parseApplySummary(activity.metadata);
  const isAuto = activity.action === "recurring_auto_apply";
  const ModeIcon = isAuto ? CalendarClock : Repeat;

  return (
    <>
      {/* Header */}
      <div className="border-b border-primary/10 bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground truncate">
            {templateName}
          </p>
          <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">
            {addedCount} added
          </p>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatApplyDate(date)}
            </span>
            <span className="flex items-center gap-1">
              <ModeIcon className="h-3 w-3" />
              {isAuto ? "Automatic" : "Manual"}
            </span>
          </span>
          <PersonBadge {...badgeProps(activity.actorKey, personMap)} />
        </div>
      </div>

      {/* Skipped as duplicates of a manual entry */}
      {duplicates.length > 0 && (
        <div className="border-b border-primary/10 px-4 py-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
            <Copy className="h-3 w-3" />
            Skipped — already logged
          </p>
          <ul className="space-y-0.5">
            {duplicates.map((where, i) => (
              <li key={i} className="text-sm text-foreground">
                {where || "—"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Flagged because a tag was deleted — needs the owner's attention */}
      {flagged.length > 0 && (
        <div className="border-b border-primary/10 px-4 py-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Flagged — tag deleted
          </p>
          <ul className="space-y-0.5">
            {flagged.map((where, i) => (
              <li key={i} className="text-sm text-foreground">
                {where || "—"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {duplicates.length === 0 && flagged.length === 0 && (
        <div className="px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {addedCount === 0
              ? "No expenses were added."
              : "All items added — nothing skipped."}
          </p>
        </div>
      )}
    </>
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
  const { month, year, totalOwed, owedBy, owedTo, closedAt, note, person1OwesPerson2: p1OwesP2, person2OwesPerson1: p2OwesP1 } = settlement;
  // Use persisted breakdown amounts if available, otherwise fallback to deriving from totalOwed
  const person1OwesPerson2 = p1OwesP2 ?? (owedBy === "person1" ? totalOwed : 0);
  const person2OwesPerson1 = p2OwesP1 ?? (owedBy === "person2" ? totalOwed : 0);
  const payer = personMap.get(owedBy)?.displayName ?? owedBy;
  const receiver = personMap.get(owedTo)?.displayName ?? owedTo;

  return (
    <>
      {/* Header */}
      <div className="border-b border-primary/10 bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{formatMonthYear(month, year, { omitCurrentYear: false })}</p>
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
