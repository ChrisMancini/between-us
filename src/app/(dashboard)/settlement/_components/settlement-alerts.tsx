import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SerializedSettlement } from "@/lib/models/settlement";
import { formatMonthYear } from "@/lib/utils";

interface MonthRef {
  month: number;
  year: number;
}

export function SettlementAlerts({
  reopenedSettlements,
  unsettledMonths,
  closedSettlement,
  isClosed,
  month,
  year,
}: {
  reopenedSettlements: MonthRef[];
  unsettledMonths: MonthRef[];
  closedSettlement: SerializedSettlement | null;
  isClosed: boolean;
  month: number;
  year: number;
}) {
  return (
    <>
      {reopenedSettlements.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {reopenedSettlements.length === 1
                ? "A month has been reopened"
                : `${reopenedSettlements.length} months have been reopened`}
            </span>
            <span className="text-amber-700 dark:text-amber-400"> — </span>
            {reopenedSettlements.map((s, i) => {
              const isCurrentView = s.month === month && s.year === year;
              return (
                <span key={`${s.year}-${s.month}`}>
                  {i > 0 && ", "}
                  {isCurrentView ? (
                    <span className="font-medium text-amber-800 dark:text-amber-300">
                      {formatMonthYear(s.month, s.year)}
                    </span>
                  ) : (
                    <Link
                      href={`/settlement?month=${s.month}&year=${s.year}`}
                      className="font-medium text-amber-800 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
                    >
                      {formatMonthYear(s.month, s.year)}
                    </Link>
                  )}
                </span>
              );
            })}
          </div>
          <Badge
            variant="outline"
            className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 font-medium shrink-0"
          >
            Needs attention
          </Badge>
        </div>
      )}

      {unsettledMonths.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-orange-800 dark:text-orange-300">
              {unsettledMonths.length === 1
                ? "A past month hasn’t been closed"
                : `${unsettledMonths.length} past months haven’t been closed`}
            </span>
            <span className="text-orange-700 dark:text-orange-400"> — </span>
            {unsettledMonths.map((m, i) => {
              const isCurrentView = m.month === month && m.year === year;
              return (
                <span key={`${m.year}-${m.month}`}>
                  {i > 0 && ", "}
                  {isCurrentView ? (
                    <span className="font-medium text-orange-800 dark:text-orange-300">
                      {formatMonthYear(m.month, m.year)}
                    </span>
                  ) : (
                    <Link
                      href={`/settlement?month=${m.month}&year=${m.year}`}
                      className="font-medium text-orange-800 dark:text-orange-300 underline underline-offset-2 hover:text-orange-900 dark:hover:text-orange-200"
                    >
                      {formatMonthYear(m.month, m.year)}
                    </Link>
                  )}
                </span>
              );
            })}
          </div>
          <Badge
            variant="outline"
            className="border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400 font-medium shrink-0"
          >
            Not closed
          </Badge>
        </div>
      )}

      {isClosed && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              Month closed
            </span>
            <span className="text-emerald-700 dark:text-emerald-400">
              {" "}
              — settled on{" "}
              {new Date(closedSettlement!.closedAt).toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" }
              )}
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 font-medium"
          >
            Closed
          </Badge>
        </div>
      )}
    </>
  );
}
