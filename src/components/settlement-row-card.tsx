import Link from "next/link";
import type { ReactNode } from "react";
import { PersonBadge } from "@/components/person-badge";
import { badgeProps } from "@/lib/person-utils";
import { formatCurrency } from "@/lib/utils";
import type { SerializedPerson } from "@/types/person";

interface SettlementRowCardProps {
  /** Period label, e.g. "September" or "September 2025". */
  label: string;
  /** When set, the label links here (used by the history list). */
  href?: string;
  amount: number;
  owedBy: string;
  owedTo: string;
  personMap: Map<string, SerializedPerson>;
  /** Right-aligned extra on the badges row, e.g. a closed-on date. */
  meta?: ReactNode;
  /** Extra block below the badges row, e.g. a note. */
  children?: ReactNode;
}

/**
 * Mobile card for a single settlement row: period + amount, then
 * "owedBy owes owedTo". Shared by the annual summary and the settlement
 * history list so the two stay in sync.
 */
export function SettlementRowCard({
  label,
  href,
  amount,
  owedBy,
  owedTo,
  personMap,
  meta,
  children,
}: SettlementRowCardProps) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        {href ? (
          <Link
            href={href}
            className="font-medium text-primary hover:underline underline-offset-2"
          >
            {label}
          </Link>
        ) : (
          <span className="font-medium text-foreground">{label}</span>
        )}
        <span className="font-semibold tabular-nums text-foreground">
          {formatCurrency(amount)}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <PersonBadge {...badgeProps(owedBy, personMap)} />
        <span>owes</span>
        <PersonBadge {...badgeProps(owedTo, personMap)} />
        {meta && <span className="ml-auto whitespace-nowrap">{meta}</span>}
      </div>
      {children}
    </div>
  );
}
