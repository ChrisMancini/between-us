import { Skeleton } from "@/components/ui/skeleton";
import { TablePanelSkeleton } from "@/components/skeletons/page-skeletons";
import { LiveRegion } from "@/components/a11y/live-region";

export default function ExpensesLoading() {
  return (
    <div className="max-w-3xl space-y-8" aria-busy="true">
      <LiveRegion>Loading expenses…</LiveRegion>

      {/* Header + import button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-7 w-28" />
      </div>

      {/* Expense entry form */}
      <div className="border rounded-xl p-6 bg-card shadow-sm space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
      </div>

      {/* Expense list */}
      <TablePanelSkeleton rows={8} />
    </div>
  );
}
