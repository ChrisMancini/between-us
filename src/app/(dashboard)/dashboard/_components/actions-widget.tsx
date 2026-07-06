"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleDollarSign, AlertTriangle, AlertOctagon, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import { PersonBadge } from "@/components/person-badge";
import type { SerializedAction } from "@/lib/models/action";
import type { SerializedPerson } from "@/lib/models/person";
import { invalidateActionCount } from "@/hooks/use-action-count";
import { toast } from "sonner";
import { cn, formatMonthYear } from "@/lib/utils";
import {
  getEscalationTier,
  ESCALATION_TIER_STYLES,
  type MonthYear,
} from "@/lib/escalation-tiers";

interface ActionsWidgetProps {
  actions: SerializedAction[];
  unsettledMonths: MonthYear[];
  currentUserKey: string;
}

export function ActionsWidget({
  actions,
  unsettledMonths,
  currentUserKey,
}: ActionsWidgetProps) {
  const router = useRouter();
  const { personMap } = usePersons();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const isEmpty = actions.length === 0 && unsettledMonths.length === 0;

  async function handleAction(actionId: string, type: "pay" | "confirm") {
    setLoadingId(actionId);
    try {
      const res = await fetch(`/api/actions/${actionId}/${type}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Something went wrong");
        return;
      }
      toast.success(type === "pay" ? "Marked as paid" : "Payment confirmed");
      invalidateActionCount();
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoadingId(null);
    }
  }

  function formatAmount(cents: number) {
    return (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }

  if (isEmpty) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">Nothing to do right now.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {unsettledMonths.map((m) => (
        <UnsettledMonthItem key={`${m.year}-${m.month}`} month={m} />
      ))}
      {actions.map((action) => (
        <PaymentActionItem
          key={action._id}
          action={action}
          currentUserKey={currentUserKey}
          personMap={personMap}
          isLoading={loadingId === action._id}
          onAction={handleAction}
          formatAmount={formatAmount}
        />
      ))}
    </div>
  );
}

function UnsettledMonthItem({ month }: { month: MonthYear }) {
  const tier = getEscalationTier(month);
  const styles = tier ? ESCALATION_TIER_STYLES[tier] : null;
  const Icon = styles?.useOctagon ? AlertOctagon : AlertTriangle;

  return (
    <div className={cn("px-4 py-3", styles?.useOctagon && styles.bg)}>
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            styles ? styles.icon : "text-muted-foreground"
          )}
        />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", styles ? styles.text : "text-foreground")}>
            Mark {formatMonthYear(month.month, month.year, { omitCurrentYear: true })} as done
          </p>
        </div>
        <Link
          href={`/settlement?month=${month.month}&year=${month.year}`}
          className={cn(
            "inline-flex items-center gap-0.5 text-xs font-medium whitespace-nowrap hover:underline underline-offset-2",
            styles ? styles.text : "text-muted-foreground"
          )}
        >
          Settlement
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function PaymentActionItem({
  action,
  currentUserKey,
  personMap,
  isLoading,
  onAction,
  formatAmount,
}: {
  action: SerializedAction;
  currentUserKey: string;
  personMap: Map<string, SerializedPerson>;
  isLoading: boolean;
  onAction: (id: string, type: "pay" | "confirm") => void;
  formatAmount: (cents: number) => string;
}) {
  const isDebtor = action.debtorKey === currentUserKey;
  const otherKey = isDebtor ? action.creditorKey : action.debtorKey;

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <CircleDollarSign className="h-4 w-4 flex-shrink-0 text-teal-600 dark:text-teal-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            {isDebtor ? (
              <>
                You owe{" "}
                <PersonBadge {...badgeProps(otherKey, personMap)} className="mx-0.5" />{" "}
                <span className="font-semibold">{formatAmount(action.amount)}</span>
              </>
            ) : (
              <>
                <PersonBadge {...badgeProps(otherKey, personMap)} className="mr-0.5" />{" "}
                owes you{" "}
                <span className="font-semibold">{formatAmount(action.amount)}</span>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {action.description}
            {action.status === "paid" && (
              <span className="ml-1.5 text-blue-600 dark:text-blue-400">
                — marked paid
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {isDebtor && action.status === "pending" && (
          <Button
            size="sm"
            variant="outline"
            disabled={isLoading}
            onClick={() => onAction(action._id, "pay")}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : null}
            Mark Paid
          </Button>
        )}
        {!isDebtor && (action.status === "pending" || action.status === "paid") && (
          <Button
            size="sm"
            disabled={isLoading}
            onClick={() => onAction(action._id, "confirm")}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : null}
            Confirm Receipt
          </Button>
        )}
      </div>
    </div>
  );
}
