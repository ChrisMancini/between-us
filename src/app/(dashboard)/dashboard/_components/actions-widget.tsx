"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import { PersonBadge } from "@/components/person-badge";
import type { SerializedAction } from "@/lib/models/action";
import { invalidateActionCount } from "@/hooks/use-action-count";
import { toast } from "sonner";

interface ActionsWidgetProps {
  actions: SerializedAction[];
  currentUserKey: string;
}

export function ActionsWidget({ actions, currentUserKey }: ActionsWidgetProps) {
  const router = useRouter();
  const { personMap } = usePersons();
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  return (
    <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Actions
        </p>
      </div>

      {actions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No pending actions.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {actions.map((action) => {
            const isDebtor = action.debtorKey === currentUserKey;
            const otherKey = isDebtor ? action.creditorKey : action.debtorKey;
            const isLoading = loadingId === action._id;

            return (
              <div key={action._id} className="px-4 py-3 space-y-2">
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
                      onClick={() => handleAction(action._id, "pay")}
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
                      onClick={() => handleAction(action._id, "confirm")}
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
          })}
        </div>
      )}
    </div>
  );
}
