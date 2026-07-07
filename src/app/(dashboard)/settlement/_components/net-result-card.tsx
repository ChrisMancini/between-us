import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { SerializedPerson } from "@/lib/models/person";
import type { RunningBalance } from "@/lib/settlement-calc";
import { formatCurrency } from "@/lib/utils";
import { SettlementNote } from "./settlement-note";

export function NetResultCard({
  owedBy,
  amount,
  person1OwesPerson2,
  person2OwesPerson1,
  person1,
  person2,
  personMap,
  label,
  note,
  month,
  year,
  isClosed,
  runningBalance,
}: {
  owedBy: string;
  amount: number;
  person1OwesPerson2: number;
  person2OwesPerson1: number;
  person1: SerializedPerson;
  person2: SerializedPerson;
  personMap: Map<string, SerializedPerson>;
  label: string;
  note?: string;
  month: number;
  year: number;
  isClosed: boolean;
  runningBalance?: RunningBalance | null;
}) {
  const isEven = owedBy === "even";
  const payer = personMap.get(owedBy)?.displayName ?? owedBy;
  const receiver = isEven
    ? ""
    : [...personMap.values()].find((p) => p.key !== owedBy)?.displayName ?? "";

  return (
    <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Net Settlement — {label}
        </p>
      </div>

      <div className="px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="flex-1">
          {isEven ? (
            <div className="flex items-center gap-2">
              <Minus className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold text-muted-foreground">
                All settled
              </span>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-3xl font-bold text-foreground">{formatCurrency(amount)}</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{payer}</span>{" "}
                owes{" "}
                <span className="font-medium text-foreground">{receiver}</span>
              </p>
            </div>
          )}
          {runningBalance && runningBalance.monthCount >= 2 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {runningBalance.netOwedBy === "even"
                ? `All even across ${runningBalance.monthCount} open months`
                : `${personMap.get(runningBalance.netOwedBy)?.displayName ?? runningBalance.netOwedBy} owes ${[...personMap.values()].find((p) => p.key !== runningBalance.netOwedBy)?.displayName ?? ""} ${formatCurrency(runningBalance.netAmount)} across ${runningBalance.monthCount} open months`}
            </p>
          )}
          <SettlementNote month={month} year={year} note={note} isClosed={isClosed} />
        </div>

        <div className="flex gap-6 shrink-0">
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary/70" />
              <span className="text-xs font-semibold uppercase tracking-wide text-primary/70">
                {person2.displayName} → {person1.displayName}
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(person2OwesPerson1)}</p>
          </div>
          <div className="w-px bg-primary/10 self-stretch" />
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                {person1.displayName} → {person2.displayName}
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(person1OwesPerson2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
