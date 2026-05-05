import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PERSON_COLORS, type PersonPair } from "@/lib/person-utils";

interface SpendingSummaryCardProps {
  label: string;
  totalSpending: number;
  deferredTotal: number;
  immediateTotal: number;
  person1Total: number;
  person2Total: number;
  persons: PersonPair;
}

export function SpendingSummaryCard({
  label,
  totalSpending,
  deferredTotal,
  immediateTotal,
  person1Total,
  person2Total,
  persons,
}: SpendingSummaryCardProps) {
  return (
    <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Total Spending — {label}
        </p>
      </div>

      <div className="px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Big number */}
        <div className="flex-1">
          <p className="text-3xl font-bold text-foreground">
            {formatCurrency(totalSpending)}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            across all categories
          </p>
        </div>

        {/* Breakdown */}
        <div className="flex gap-6 shrink-0">
          {/* By settlement type */}
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary/70">
                Monthly
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatCurrency(deferredTotal)}
            </p>
          </div>
          <div className="w-px bg-primary/10 self-stretch" />
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary/70">
                Immediate
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatCurrency(immediateTotal)}
            </p>
          </div>
          <div className="w-px bg-primary/10 self-stretch" />
          {/* By person */}
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center mb-1">
              <TrendingUp className={`h-3.5 w-3.5 ${PERSON_COLORS[persons[0].colorIndex].chartIcon}`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${PERSON_COLORS[persons[0].colorIndex].chartLabel}`}>
                {persons[0].displayName}
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatCurrency(person1Total)}
            </p>
          </div>
          <div className="w-px bg-primary/10 self-stretch" />
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center mb-1">
              <TrendingDown className={`h-3.5 w-3.5 ${PERSON_COLORS[persons[1].colorIndex].chartIcon}`} />
              <span className={`text-xs font-semibold uppercase tracking-wide ${PERSON_COLORS[persons[1].colorIndex].chartLabel}`}>
                {persons[1].displayName}
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums">
              {formatCurrency(person2Total)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
