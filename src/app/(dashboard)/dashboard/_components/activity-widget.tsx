"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Repeat,
  FileUp,
} from "lucide-react";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import type { SerializedActivity } from "@/lib/models/activity";

const ACTION_ICONS: Record<string, typeof Plus> = {
  expense_create: Plus,
  expense_edit: Pencil,
  expense_delete: Trash2,
  settlement_close: CheckCircle2,
  settlement_reopen: RotateCcw,
  recurring_apply: Repeat,
  csv_import: FileUp,
};

const ACTION_COLORS: Record<string, string> = {
  expense_create: "text-emerald-600 dark:text-emerald-400",
  expense_edit: "text-blue-600 dark:text-blue-400",
  expense_delete: "text-red-600 dark:text-red-400",
  settlement_close: "text-amber-600 dark:text-amber-400",
  settlement_reopen: "text-orange-600 dark:text-orange-400",
  recurring_apply: "text-indigo-600 dark:text-indigo-400",
  csv_import: "text-violet-600 dark:text-violet-400",
};

interface ActivityWidgetProps {
  activities: SerializedActivity[];
}

export function ActivityWidget({ activities }: ActivityWidgetProps) {
  const { personMap } = usePersons();

  return (
    <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Partner Activity
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No partner activity yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {activities.map((item) => {
            const Icon = ACTION_ICONS[item.action] ?? Plus;
            const colorClass = ACTION_COLORS[item.action] ?? "";
            const timeAgo = formatDistanceToNow(new Date(item.createdAt), {
              addSuffix: true,
            });
            const fullDate = new Date(item.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });

            return (
              <div
                key={item._id}
                className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/60 transition-colors"
              >
                <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${colorClass}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">
                    <PersonBadge {...badgeProps(item.actorKey, personMap)} className="mr-1" />
                    <span className="text-foreground">{item.summary}</span>
                  </p>
                </div>
                <time
                  dateTime={item.createdAt}
                  title={fullDate}
                  className="flex-shrink-0 text-[11px] text-muted-foreground"
                >
                  {timeAgo}
                </time>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-border px-4 py-2.5">
        <Link
          href="/activity"
          className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View all activity
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
