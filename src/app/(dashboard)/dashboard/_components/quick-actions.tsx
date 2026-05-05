import Link from "next/link";
import { Plus, BarChart3, ArrowRightLeft } from "lucide-react";

const actions = [
  {
    href: "/expenses",
    label: "Log Expense",
    icon: Plus,
    description: "Add a new expense",
  },
  {
    href: "/reports",
    label: "View Reports",
    icon: BarChart3,
    description: "Spending breakdown",
  },
  {
    href: "/settlement",
    label: "Settlement",
    icon: ArrowRightLeft,
    description: "Monthly close-out",
  },
];

export function QuickActions() {
  return (
    <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Quick Actions
        </p>
      </div>

      <div className="p-4 grid gap-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary/20 hover:bg-primary/5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <action.icon className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {action.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {action.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
