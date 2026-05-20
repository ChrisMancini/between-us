import { formatCurrency } from "@/lib/utils";

interface TagTotal {
  tagName: string;
  total: number;
}

interface TagBreakdownProps {
  tags: TagTotal[];
}

export function TagBreakdown({ tags }: TagBreakdownProps) {
  if (tags.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary/20 bg-card py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No tagged expenses this month.
        </p>
      </div>
    );
  }

  const maxTotal = Math.max(...tags.map((t) => t.total));
  const grandTotal = tags.reduce((s, t) => s + t.total, 0);

  return (
    <div className="rounded-xl border border-primary/10 overflow-hidden shadow-sm bg-card">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
            By Tag
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Spending breakdown by tag. Expenses with multiple tags appear under
            each.
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(grandTotal)}
        </p>
      </div>

      <div className="divide-y divide-border">
        {tags.map((tag) => {
          const pct = maxTotal > 0 ? (tag.total / maxTotal) * 100 : 0;
          return (
            <div key={tag.tagName} className="px-5 py-3 flex items-center gap-4">
              <span className="text-sm font-medium w-32 shrink-0 truncate">
                {tag.tagName}
              </span>
              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/30"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm font-semibold tabular-nums w-24 text-right shrink-0">
                {formatCurrency(tag.total)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
