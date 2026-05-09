"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePersons } from "@/components/persons-context";

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

interface PreviousSettlement {
  totalOwed: number;
  owedBy: string;
}

interface CloseMonthDialogProps {
  month: number;
  year: number;
  summary: string;
  newTotalOwed: number;
  newOwedBy: string;
  previous?: PreviousSettlement;
  disabled?: boolean;
}

export function CloseMonthDialog({
  month,
  year,
  summary,
  newTotalOwed,
  newOwedBy,
  previous,
  disabled,
}: CloseMonthDialogProps) {
  const router = useRouter();
  const { personMap } = usePersons();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isReclose = !!previous;

  function displayName(key: string): string {
    return personMap.get(key)?.displayName ?? key;
  }

  function otherDisplayName(key: string): string {
    return [...personMap.values()].find((p) => p.key !== key)?.displayName ?? key;
  }

  // Calculate the net delta payment needed
  function computeDelta(): { amount: number; direction: string } | null {
    if (!previous || newOwedBy === "even") return null;

    const prevPayer = previous.owedBy; // who owed previously
    const newPayer = newOwedBy;        // who owes now

    if (prevPayer === newPayer) {
      // Same direction — just pay the difference
      const delta = newTotalOwed - previous.totalOwed;
      if (delta === 0) return null;
      const payer = delta > 0 ? newPayer : prevPayer;
      const payerLabel = displayName(payer);
      const receiverLabel = otherDisplayName(payer);
      return {
        amount: Math.abs(delta),
        direction: `${payerLabel} pays ${receiverLabel} an additional ${fmt(Math.abs(delta))}`,
      };
    } else {
      // Direction flipped — previous payment needs to be refunded + new amount
      const total = previous.totalOwed + newTotalOwed;
      const prevReceiverLabel = otherDisplayName(prevPayer); // was receiver
      const newPayerLabel = displayName(newPayer);
      return {
        amount: total,
        direction: `${prevReceiverLabel} gets back ${fmt(previous.totalOwed)} and ${newPayerLabel} pays ${fmt(newTotalOwed)}`,
      };
    }
  }

  const delta = computeDelta();

  async function handleClose() {
    setLoading(true);
    try {
      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to close month");
        return;
      }

      toast.success(isReclose ? "Month re-closed" : "Month closed successfully");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            className="gap-2"
            disabled={disabled}
            title={disabled ? "Both people must mark as done first" : undefined}
          />
        }
      >
        <Lock className="h-4 w-4" />
        {isReclose ? "Re-close Month" : "Close Month"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isReclose ? "Re-close this month?" : "Close this month?"}
          </DialogTitle>
          <DialogDescription className="pt-1">
            {isReclose
              ? "Review the updated settlement before locking the month again."
              : "This will record the final settlement and lock the month."}
          </DialogDescription>
        </DialogHeader>

        {isReclose && previous ? (
          <div className="space-y-3">
            {/* Before / After */}
            <div className="rounded-lg border border-primary/10 bg-primary/5 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Previously settled</span>
                <span className="font-medium line-through text-muted-foreground">
                  {fmt(previous.totalOwed)}{" "}
                  <span className="text-xs">
                    ({displayName(previous.owedBy)} owed)
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">New settlement</span>
                <span className="font-semibold text-foreground">
                  {summary}
                </span>
              </div>
            </div>

            {/* Delta */}
            {delta ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                <p className="font-semibold mb-0.5">What still needs to change hands</p>
                <p>{delta.direction}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/50 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                No additional payment needed — amount unchanged.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-primary/10 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
            {summary}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleClose} disabled={loading}>
            {loading ? "Closing…" : isReclose ? "Confirm & Re-close" : "Confirm & Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
