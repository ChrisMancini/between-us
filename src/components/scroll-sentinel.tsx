"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface ScrollSentinelProps {
  loading: boolean;
}

export const ScrollSentinel = forwardRef<HTMLDivElement, ScrollSentinelProps>(
  function ScrollSentinel({ loading }, ref) {
    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="border-t border-border px-4 py-3 flex items-center justify-center"
      >
        {loading && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Loading more...
          </span>
        )}
      </div>
    );
  },
);
