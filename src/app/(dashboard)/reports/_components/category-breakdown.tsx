import { formatCurrency } from "@/lib/utils";

interface CategoryTotal {
  categoryName: string;
  settlementType: "immediate" | "deferred";
  total: number;
}

interface CategoryBreakdownProps {
  categories: CategoryTotal[];
}

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const deferred = categories.filter((c) => c.settlementType === "deferred");
  const immediate = categories.filter((c) => c.settlementType === "immediate");

  return (
    <div className="space-y-4">
      <CategoryTable
        title="Settled Monthly"
        description="Expenses included in monthly settlement."
        categories={deferred}
      />
      {immediate.length > 0 && (
        <CategoryTable
          title="Settled Immediately"
          description="Expenses paid directly, excluded from monthly settlement."
          categories={immediate}
          muted
        />
      )}
    </div>
  );
}

function CategoryTable({
  title,
  description,
  categories,
  muted = false,
}: {
  title: string;
  description: string;
  categories: CategoryTotal[];
  muted?: boolean;
}) {
  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary/20 bg-card py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No {title.toLowerCase()} expenses this month.
        </p>
      </div>
    );
  }

  const maxTotal = Math.max(...categories.map((c) => c.total));
  const grandTotal = categories.reduce((s, c) => s + c.total, 0);

  return (
    <div
      className={`rounded-xl border overflow-hidden shadow-sm bg-card ${muted ? "border-border opacity-70" : "border-primary/10"}`}
    >
      <div
        className={`border-b px-5 py-3 flex items-center justify-between ${muted ? "border-border bg-muted/60" : "border-primary/10 bg-primary/5"}`}
      >
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${muted ? "text-muted-foreground" : "text-primary/70"}`}
          >
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(grandTotal)}
        </p>
      </div>

      <div className="divide-y divide-border">
        {categories.map((cat) => {
          const pct = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
          return (
            <div key={cat.categoryName} className="px-5 py-3 flex items-center gap-4">
              <span className="text-sm font-medium w-28 shrink-0">
                {cat.categoryName}
              </span>
              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${muted ? "bg-muted-foreground/30" : "bg-primary/30"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm font-semibold tabular-nums w-24 text-right shrink-0">
                {formatCurrency(cat.total)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
