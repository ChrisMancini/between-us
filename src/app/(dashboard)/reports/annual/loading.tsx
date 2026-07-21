import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  SummaryCardSkeleton,
  TablePanelSkeleton,
} from "@/components/skeletons/page-skeletons";

export default function AnnualReportLoading() {
  return (
    <div className="space-y-6">
      {/* Back to Reports link */}
      <Skeleton className="h-4 w-32" />

      <PageHeaderSkeleton withAction />

      <SummaryCardSkeleton />

      {/* Highlights — three stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-primary/10 bg-card shadow-sm px-5 py-4 space-y-3"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      {/* Who pays split */}
      <div className="rounded-xl border border-primary/10 bg-card shadow-sm px-5 py-5 space-y-3">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-6 w-full rounded-full" />
      </div>

      {/* Tag breakdown */}
      <TablePanelSkeleton rows={6} />

      {/* Monthly trend — a 12-row table in MonthlyTrend */}
      <TablePanelSkeleton rows={12} />

      {/* Annual settlement summary */}
      <TablePanelSkeleton rows={4} />
    </div>
  );
}
