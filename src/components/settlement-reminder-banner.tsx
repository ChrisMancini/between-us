import Link from "next/link";
import { AlertTriangle, AlertOctagon, ArrowRight } from "lucide-react";
import { cn, formatMonthYear } from "@/lib/utils";
import {
  getHighestEscalationTier,
  ESCALATION_TIER_STYLES,
  type MonthYear,
} from "@/lib/escalation-tiers";

interface SettlementReminderBannerProps {
  months: MonthYear[];
}

function getBannerText(months: MonthYear[]): string {
  if (months.length === 1) {
    return `You haven’t marked ${formatMonthYear(months[0].month, months[0].year)} as done yet.`;
  }
  if (months.length === 2) {
    return `You haven’t marked ${formatMonthYear(months[0].month, months[0].year)} and ${formatMonthYear(months[1].month, months[1].year)} as done yet.`;
  }
  return `You have ${months.length} months waiting to be closed.`;
}

function getBannerLink(months: MonthYear[]): string {
  if (months.length <= 2) {
    return `/settlement?month=${months[0].month}&year=${months[0].year}`;
  }
  return "/settlement";
}

export function SettlementReminderBanner({
  months,
}: SettlementReminderBannerProps) {
  const tier = getHighestEscalationTier(months);
  if (!tier || tier === "warning") return null;

  const styles = ESCALATION_TIER_STYLES[tier];

  return (
    <div className={cn("border-b", styles.border, styles.bg)}>
      <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center gap-3">
        {styles.useOctagon
          ? <AlertOctagon className={cn("h-4 w-4 shrink-0", styles.icon)} />
          : <AlertTriangle className={cn("h-4 w-4 shrink-0", styles.icon)} />
        }
        <p className={cn("flex-1 text-sm font-medium", styles.text)}>
          {getBannerText(months)}
        </p>
        <Link
          href={getBannerLink(months)}
          className={cn(
            "inline-flex items-center gap-1 text-sm font-semibold whitespace-nowrap underline-offset-2 hover:underline",
            styles.text
          )}
        >
          Go to Settlement
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
