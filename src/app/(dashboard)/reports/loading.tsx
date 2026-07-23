import {
  PageHeaderSkeleton,
  SummaryCardSkeleton,
  TablePanelSkeleton,
} from "@/components/skeletons/page-skeletons";
import { LiveRegion } from "@/components/a11y/live-region";

export default function ReportsLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <LiveRegion>Loading reports…</LiveRegion>

      <PageHeaderSkeleton withAction />

      <SummaryCardSkeleton />

      {/* Tag breakdown */}
      <TablePanelSkeleton rows={5} />

      {/* Person x tag matrix */}
      <TablePanelSkeleton rows={4} />

      {/* Monthly trend — a 6-row table in MonthlyTrend */}
      <TablePanelSkeleton rows={6} />
    </div>
  );
}
