import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared skeleton primitives used by route-level `loading.tsx` files.
 *
 * These mirror the *shape* of the real components so the page doesn't shift
 * when data resolves and the skeleton is swapped for content. Keep the outer
 * dimensions (padding, card chrome, row counts) in sync with the components
 * they stand in for.
 */

/**
 * The bordered card + header strip chrome shared by nearly every panel on the
 * dashboard and reports pages (`SpendingSummaryCard`, `RecentExpenses`,
 * `TagBreakdown`, `MonthlyTrend`, dashboard widgets, ...). Extracted so a chrome
 * tweak lives in one place rather than being re-hand-rolled per loading file.
 */
export function SkeletonPanel({
  headerWidth = "w-40",
  bodyClassName,
  children,
}: {
  headerWidth?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <Skeleton className={`h-3.5 ${headerWidth}`} />
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/**
 * Page header: title + subtitle, with an optional right-aligned action slot
 * (e.g. a month nav or an import button).
 */
export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {withAction && <Skeleton className="h-9 w-44" />}
    </div>
  );
}

/**
 * Mirrors {@link SpendingSummaryCard}: a header strip, a large total on the
 * left, and a four-column breakdown on the right. Reused by the dashboard,
 * monthly reports, and annual report pages.
 */
export function SummaryCardSkeleton() {
  return (
    <SkeletonPanel
      headerWidth="w-48"
      bodyClassName="px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-5"
    >
      {/* Big total */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Breakdown columns */}
      <div className="flex gap-6 shrink-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6">
            {i > 0 && <div className="w-px bg-primary/10 self-stretch" />}
            <div className="space-y-2 text-center">
              <Skeleton className="h-3 w-16 mx-auto" />
              <Skeleton className="h-5 w-14 mx-auto" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonPanel>
  );
}

/**
 * A header-stripped panel wrapping a table of rows — mirrors the chrome shared
 * by the recent-expenses, tag-breakdown, and monthly-trend panels. Set
 * `withFooter` for panels that end in an action row (e.g. "View all expenses").
 */
export function TablePanelSkeleton({
  rows = 5,
  withFooter = false,
}: {
  rows?: number;
  withFooter?: boolean;
}) {
  return (
    <SkeletonPanel headerWidth="w-36">
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-12 shrink-0" />
            <Skeleton className="h-4 flex-1 max-w-[8rem]" />
            <Skeleton className="h-4 flex-1 max-w-[10rem]" />
            <Skeleton className="h-5 w-16 shrink-0 ml-auto" />
          </div>
        ))}
      </div>
      {withFooter && (
        <div className="border-t border-border px-4 py-2.5 flex justify-center">
          <Skeleton className="h-4 w-32" />
        </div>
      )}
    </SkeletonPanel>
  );
}
