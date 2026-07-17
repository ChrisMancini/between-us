"use client";

import { useState, useCallback } from "react";
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
import type { SerializedActivity } from "@/lib/models/activity";
import type { SerializedPerson } from "@/types/person";

interface ActivityFeedProps {
  initialItems: SerializedActivity[];
  initialCursor: string | null;
}

export function ActivityFeed({ initialItems, initialCursor }: ActivityFeedProps) {
  const { personMap } = usePersons();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"partner" | "all">("partner");

  const fetchPage = useCallback(
    async (newFilter: "partner" | "all", pageCursor: string | null, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ filter: newFilter, limit: "20" });
        if (pageCursor) params.set("cursor", pageCursor);
        const res = await fetch(`/api/activity?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setItems((prev) => (append ? [...prev, ...data.activities] : data.activities));
        setCursor(data.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleFilterChange = (newFilter: "partner" | "all") => {
    if (newFilter === filter) return;
    setFilter(newFilter);
    fetchPage(newFilter, null, false);
  };

  const loadMore = () => {
    if (cursor) fetchPage(filter, cursor, true);
  };

  return (
    <div className="space-y-4">
      {/* Filter toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => handleFilterChange("partner")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === "partner"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Partner
        </button>
        <button
          onClick={() => handleFilterChange("all")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
      </div>

      {/* Activity list */}
      <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {filter === "partner" ? "No partner activity yet." : "No activity yet."}
            </p>
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
