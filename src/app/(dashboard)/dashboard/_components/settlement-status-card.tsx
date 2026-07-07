"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ArrowRight,
  Minus,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { usePersons } from "@/components/persons-context";

interface SettlementStatusCardProps {
  monthLabel: string;
  isClosed: boolean;
  netOwedBy: string;
  netAmount: number;
}

export function SettlementStatusCard({
  isClosed,
  netOwedBy,
  netAmount,
}: SettlementStatusCardProps) {
  const { personMap } = usePersons();
  const isEven = netOwedBy === "even";
  const payer = personMap.get(netOwedBy)?.displayName ?? netOwedBy;
  const receiver = isEven
    ? ""
    : [...personMap.values()].find((p) => p.key !== netOwedBy)?.displayName ?? "";

  return (
    <div className="px-5 py-5 space-y-4">
      {isClosed ? (
          /* ── Closed ── */
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500 shrink-0" />
            <div className="flex-1 text-sm">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                Month closed
              </span>
              {!isEven && (
                <span className="text-emerald-700 dark:text-emerald-400">
                  {" — "}
                  {payer} owed {receiver} {formatCurrency(netAmount)}
                </span>
              )}
            </div>
          </div>
        ) : isEven ? (
          /* ── Even ── */
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-3">
            <Minus className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium text-muted-foreground">
              All settled — no money changes hands
            </p>
          </div>
        ) : (
          /* ── Open with balance ── */
          <div className="space-y-1">
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(netAmount)}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{payer}</span> owes{" "}
              <span className="font-medium text-foreground">{receiver}</span>
            </p>
          </div>
        )}

        <Link
          href="/settlement"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/20 hover:bg-primary/5"
        >
          {isClosed ? "View details" : "Go to Settlement"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
    </div>
  );
}
