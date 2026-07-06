export interface MonthYear {
  month: number;
  year: number;
}

export type EscalationTier = "warning" | "overdue" | "critical";

const TIER_ORDER: Record<EscalationTier, number> = {
  warning: 1,
  overdue: 2,
  critical: 3,
};

export function getEscalationTier(
  monthYear: MonthYear,
  now: Date = new Date()
): EscalationTier | null {
  const nowMs = now.getTime();
  const monthEnd = Date.UTC(monthYear.year, monthYear.month, 1);

  const criticalThreshold = Date.UTC(monthYear.year, monthYear.month + 2, 1);
  const overdueThreshold = Date.UTC(monthYear.year, monthYear.month + 1, 1);
  const warningThreshold = monthEnd + 7 * 24 * 60 * 60 * 1000;

  if (nowMs >= criticalThreshold) return "critical";
  if (nowMs >= overdueThreshold) return "overdue";
  if (nowMs >= warningThreshold) return "warning";
  return null;
}

export function getHighestEscalationTier(
  months: MonthYear[],
  now: Date = new Date()
): EscalationTier | null {
  let highest: EscalationTier | null = null;

  for (const m of months) {
    const tier = getEscalationTier(m, now);
    if (tier && (!highest || TIER_ORDER[tier] > TIER_ORDER[highest])) {
      highest = tier;
    }
  }

  return highest;
}

export const ESCALATION_TIER_STYLES: Record<
  EscalationTier,
  { border: string; bg: string; text: string; icon: string; dot: string; useOctagon?: boolean }
> = {
  warning: {
    border: "border-amber-200 dark:border-amber-800",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    text: "text-amber-800 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-500",
    dot: "bg-amber-500",
  },
  overdue: {
    border: "border-red-200 dark:border-red-800",
    bg: "bg-red-50 dark:bg-red-950/50",
    text: "text-red-800 dark:text-red-300 font-semibold",
    icon: "text-red-600 dark:text-red-500",
    dot: "bg-red-500",
  },
  critical: {
    border: "border-red-300 dark:border-red-700",
    bg: "bg-red-100 dark:bg-red-950",
    text: "text-red-900 dark:text-red-200 font-bold",
    icon: "text-red-700 dark:text-red-400",
    dot: "bg-red-600 dark:bg-red-500",
    useOctagon: true,
  },
};

