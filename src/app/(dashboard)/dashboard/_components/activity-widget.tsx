"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Repeat,
  FileUp,
  CircleDollarSign,
  Send,
  CheckCheck,
  XCircle,
} from "lucide-react";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatActivityDate } from "@/lib/utils";
import type { SerializedActivity } from "@/lib/models/activity";

function useIsTruncated(ref: React.RefObject<HTMLElement | null>) {
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setIsTruncated(el.scrollWidth > el.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return isTruncated;
}

const ACTION_ICONS: Record<string, typeof Plus> = {
  expense_create: Plus,
  expense_edit: Pencil,
  expense_delete: Trash2,
  settlement_close: CheckCircle2,
  settlement_reopen: RotateCcw,
  recurring_apply: Repeat,
  csv_import: FileUp,
  action_created: CircleDollarSign,
  action_paid: Send,
  action_confirmed: CheckCheck,
  action_cancelled: XCircle,
};

const ACTION_COLORS: Record<string, string> = {
  expense_create: "text-emerald-600 dark:text-emerald-400",
  expense_edit: "text-blue-600 dark:text-blue-400",
  expense_delete: "text-red-600 dark:text-red-400",
  settlement_close: "text-amber-600 dark:text-amber-400",
  settlement_reopen: "text-orange-600 dark:text-orange-400",
  recurring_apply: "text-indigo-600 dark:text-indigo-400",
  csv_import: "text-violet-600 dark:text-violet-400",
  action_created: "text-teal-600 dark:text-teal-400",
  action_paid: "text-blue-600 dark:text-blue-400",
  action_confirmed: "text-emerald-600 dark:text-emerald-400",
  action_cancelled: "text-slate-500 dark:text-slate-400",
};

interface ActivityRowProps {
  item: SerializedActivity;
  personMap: ReturnType<typeof usePersons>["personMap"];
}

function ActivityRow({ item, personMap }: ActivityRowProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const isTruncated = useIsTruncated(ref);
  const Icon = ACTION_ICONS[item.action] ?? Plus;
  const colorClass = ACTION_COLORS[item.action] ?? "";
  const { timeAgo, fullDate } = formatActivityDate(item.createdAt);

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/60 transition-colors">
      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${colorClass}`} />
      <div className="flex-1 min-w-0">
        <Tooltip>
          <TooltipTrigger
            disabled={!isTruncated}
            render={
              <p
                ref={ref}
                className="text-xs truncate"
                tabIndex={isTruncated ? 0 : undefined}
              />
            }
          >
            <PersonBadge {...badgeProps(item.actorKey, personMap)} className="mr-1" />
            <span className="text-foreground">{item.summary}</span>
          </TooltipTrigger>
          <TooltipContent>{item.summary}</TooltipContent>
        </Tooltip>
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
}

interface ActivityWidgetProps {
  activities: SerializedActivity[];
}

export function ActivityWidget({ activities }: ActivityWidgetProps) {
  const { personMap } = usePersons();

  return (
    <div>
      {activities.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No partner activity yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {activities.map((item) => (
            <ActivityRow key={item._id} item={item} personMap={personMap} />
          ))}
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
