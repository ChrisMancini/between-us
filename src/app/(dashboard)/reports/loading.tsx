import {
  PageHeaderSkeleton,
  SummaryCardSkeleton,
  TablePanelSkeleton,
} from "@/components/skeletons/page-skeletons";

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
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
