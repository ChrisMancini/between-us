"use client";

import { formatCurrency } from "@/lib/utils";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";

export interface SettlementRow {
  month: number;
  year: number;
  totalOwed: number;
  owedBy: string;
  owedTo: string;
}

interface AnnualSettlementSummaryProps {
  settlements: SettlementRow[];
}

function monthLabel(month: number) {
  return new Date(2000, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
  });
}

export function AnnualSettlementSummary({
  settlements,
}: AnnualSettlementSummaryProps) {
  const { personMap } = usePersons();

  if (settlements.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary/20 bg-card py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No settled months this year.
        </p>
      </div>
    );
  }

  const netByPerson = new Map<string, number>();
  for (const s of settlements) {
    netByPerson.set(s.owedBy, (netByPerson.get(s.owedBy) ?? 0) + s.totalOwed);
    netByPerson.set(s.owedTo, (netByPerson.get(s.owedTo) ?? 0) - s.totalOwed);
  }

  let netPersonKey = "";
  let netAmount = 0;
  for (const [key, val] of netByPerson) {
    if (val > 0) {
      netPersonKey = key;
      netAmount = val;
      break;
    }
  }

  const owedToKey =
    netAmount > 0
      ? [...netByPerson.entries()].find(([, v]) => v < 0)?.[0] ?? ""
      : "";

  return (
    <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Annual Settlement Summary
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Net of all closed months.
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Month
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Owed By
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Owed To
            </th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {settlements.map((s) => (
            <tr
              key={`${s.year}-${s.month}`}
              className="hover:bg-muted/60 transition-colors"
            >
              <td className="px-4 py-2.5">{monthLabel(s.month)}</td>
              <td className="px-4 py-2.5">
                <PersonBadge {...badgeProps(s.owedBy, personMap)} />
              </td>
              <td className="px-4 py-2.5">
                <PersonBadge {...badgeProps(s.owedTo, personMap)} />
              </td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                {formatCurrency(s.totalOwed)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/50">
            <td colSpan={3} className="px-4 py-2.5 font-semibold">
              {netAmount === 0 ? (
                "Even"
              ) : (
                <span className="flex items-center gap-1.5">
                  Overall:
                  <PersonBadge {...badgeProps(netPersonKey, personMap)} />
                  owes
                  <PersonBadge {...badgeProps(owedToKey, personMap)} />
                </span>
              )}
            </td>
            <td className="px-4 py-2.5 text-right font-bold tabular-nums">
              {netAmount === 0 ? "—" : formatCurrency(netAmount)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
