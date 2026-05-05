"use client";

import { Badge } from "@/components/ui/badge";

const DEFAULT_CATEGORIES = [
  { name: "Mortgage", settlementType: "immediate" },
  { name: "Groceries", settlementType: "deferred" },
  { name: "Bills", settlementType: "deferred" },
  { name: "Miscellaneous", settlementType: "deferred" },
  { name: "Insurance", settlementType: "deferred" },
] as const;

export function CategoriesStep() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold">Default Categories</h2>
        <p className="text-sm text-muted-foreground">
          These expense categories will be created. You can add, edit, or remove
          them later in Admin&nbsp;&rarr;&nbsp;Categories.
        </p>
      </div>

      <div className="rounded-xl border border-primary/10 bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {DEFAULT_CATEGORIES.map((cat) => (
            <div
              key={cat.name}
              className="flex items-center justify-between px-5 py-3"
            >
              <span className="text-sm font-medium">{cat.name}</span>
              <Badge
                variant="outline"
                className={
                  cat.settlementType === "immediate"
                    ? "text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-600"
                    : "text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-600"
                }
              >
                {cat.settlementType}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        <strong>Immediate</strong> categories are settled at time of expense.{" "}
        <strong>Deferred</strong> categories accumulate and settle monthly.
      </p>
    </div>
  );
}
