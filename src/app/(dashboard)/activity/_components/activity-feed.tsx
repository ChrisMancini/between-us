"use client";

import { useState, useEffect } from "react";
import { formatActivityDate } from "@/lib/utils";
import { ArrowRight, Loader2 } from "lucide-react";
import { PersonBadge } from "@/components/person-badge";
import { ActivityLink } from "@/components/activity-link";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import {
  ACTION_COLORS,
  ACTION_ICONS,
  activityGlyphLabel,
} from "@/lib/activity-glyph";
import { ACTIVITY_GROUPS, type ActivityGroupSlug } from "@/lib/activity-groups";
import type { SerializedActivity } from "@/lib/models/activity";
import type { SerializedPerson } from "@/types/person";
import { ActivityFilters } from "./activity-filters";

interface ActivityFeedProps {
  initialItems: SerializedActivity[];
  initialCursor: string | null;
  filter: "partner" | "all";
  action: ActivityGroupSlug | null;
  from: string | null;
  to: string | null;
}

export function ActivityFeed({
  initialItems,
  initialCursor,
  filter,
  action,
  from,
  to,
}: ActivityFeedProps) {
  const { personMap } = usePersons();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  // The URL is the source of truth for the filters, so the server hands us a
  // fresh first page whenever they change. Re-seed the list (and reset
  // pagination) on any filter change; appended "Load More" pages survive
  // in-between because the key only changes when a filter actually changes.
  const filterKey = `${filter}:${action ?? ""}:${from ?? ""}:${to ?? ""}`;
  useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const groupLabel = action
    ? ACTIVITY_GROUPS.find((g) => g.slug === action)?.label
    : null;
  const emptyMessage = groupLabel
    ? `No ${groupLabel.toLowerCase()} activity yet.`
    : filter === "partner"
    ? "No partner activity yet."
    : "No activity yet.";

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter, limit: "20", cursor });
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems((prev) => [...prev, ...data.activities]);
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <ActivityFilters filter={filter} action={action} from={from} to={to} />

      {/* Activity list */}
      <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <ActivityItem key={item._id} item={item} personMap={personMap} />
            ))}
          </div>
        )}

        {cursor && (
          <div className="border-t border-border px-4 py-3">
            <button
              onClick={loadMore}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 w-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Load more
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityItem({
  item,
  personMap,
}: {
  item: SerializedActivity;
  personMap: Map<string, SerializedPerson>;
}) {
  const Icon = ACTION_ICONS[item.action];
  const { text, bg } = ACTION_COLORS[item.action];
  const glyphLabel = activityGlyphLabel(item.action);
  const { timeAgo, fullDate } = formatActivityDate(item.createdAt, true);

  return (
    <ActivityLink activity={item}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className={`flex-shrink-0 rounded-lg p-2 ${text} ${bg}`}
          title={glyphLabel}
        >
          <Icon className="h-4 w-4" aria-label={glyphLabel} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <PersonBadge {...badgeProps(item.actorKey, personMap)} className="mr-1.5" />
            <span className="text-foreground">{item.summary}</span>
          </p>
        </div>
        <time
          dateTime={item.createdAt}
          title={fullDate}
          className="flex-shrink-0 text-xs text-muted-foreground"
        >
          {timeAgo}
        </time>
      </div>
    </ActivityLink>
  );
}
