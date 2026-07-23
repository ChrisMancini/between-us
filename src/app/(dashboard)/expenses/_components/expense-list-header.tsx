"use client";

import { Button } from "@/components/ui/button";
import { LiveRegion } from "@/components/a11y/live-region";

interface ExpenseListHeaderProps {
  bulkEditMode: boolean;
  selectedCount: number;
  itemCount: number;
  totalCount: number;
  onEnterBulkEdit: () => void;
  onExitBulkEdit: () => void;
}

/** The count / bulk-edit toggle bar above the expense list. */
export function ExpenseListHeader({
  bulkEditMode,
  selectedCount,
  itemCount,
  totalCount,
  onEnterBulkEdit,
  onExitBulkEdit,
}: ExpenseListHeaderProps) {
  return (
    <div className="border-b border-primary/10 bg-primary/5 px-4 py-2.5 flex items-center justify-between">
      {bulkEditMode ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
            {selectedCount} selected
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={onExitBulkEdit}
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
            Expenses
          </p>
          <div className="flex items-center gap-2">
            <LiveRegion visible className="text-xs text-muted-foreground">
              {itemCount === totalCount
                ? `${totalCount} ${totalCount === 1 ? "expense" : "expenses"}`
                : `Showing 1–${itemCount} of ${totalCount}`}
            </LiveRegion>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={onEnterBulkEdit}
            >
              Bulk Edit
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
