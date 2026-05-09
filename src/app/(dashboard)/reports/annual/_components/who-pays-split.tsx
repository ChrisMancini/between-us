"use client";

import { formatCurrency } from "@/lib/utils";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { PERSON_COLORS, badgeProps } from "@/lib/person-utils";

interface WhoPaysSplitProps {
  person1Total: number;
  person2Total: number;
}

export function WhoPaysSplit({ person1Total, person2Total }: WhoPaysSplitProps) {
  const { persons, personMap } = usePersons();
  const grandTotal = person1Total + person2Total;

  if (grandTotal === 0) return null;

  const person1Pct = Math.round((person1Total / grandTotal) * 100);
  const person2Pct = 100 - person1Pct;

  return (
    <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Who Paid More
        </p>
      </div>

      <div className="px-5 py-5 space-y-4">
        {/* Bar */}
        <div className="h-6 rounded-full overflow-hidden flex">
          <div
            className={`${PERSON_COLORS[persons[0].colorIndex].bg} transition-all`}
            style={{ width: `${person1Pct}%` }}
          />
          <div
            className={`${PERSON_COLORS[persons[1].colorIndex].bg} transition-all`}
            style={{ width: `${person2Pct}%` }}
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between">
          <div className="flex items-center gap-2">
            <PersonBadge {...badgeProps(persons[0].key, personMap)} />
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(person1Total)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({person1Pct}%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              ({person2Pct}%)
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(person2Total)}
            </span>
            <PersonBadge {...badgeProps(persons[1].key, personMap)} />
          </div>
        </div>
      </div>
    </div>
  );
}
