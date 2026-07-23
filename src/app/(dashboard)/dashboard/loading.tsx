import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  SkeletonPanel,
  SummaryCardSkeleton,
  TablePanelSkeleton,
} from "@/components/skeletons/page-skeletons";
import { LiveRegion } from "@/components/a11y/live-region";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <LiveRegion>Loading dashboard…</LiveRegion>

      <PageHeaderSkeleton />

      {/* Two-column grid — mirrors DashboardPage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — spending summary + recent expenses */}
        <div className="lg:col-span-2 space-y-6">
          <SummaryCardSkeleton />
          <TablePanelSkeleton rows={6} withFooter />
        </div>

        {/* Right column — widget stack */}
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonPanel key={i} headerWidth="w-28" bodyClassName="px-5 py-5 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </SkeletonPanel>
          ))}
        </div>
      </div>
    </div>
  );
}
