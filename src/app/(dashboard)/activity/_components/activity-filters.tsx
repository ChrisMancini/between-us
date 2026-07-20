"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVITY_GROUPS,
  type ActivityGroupSlug,
} from "@/lib/activity-groups";

const ALL_ACTIONS = "__all__";

interface ActivityFiltersProps {
  filter: "partner" | "all";
  action: ActivityGroupSlug | null;
}

/**
 * The activity feed's filter bar: the Partner/All scope toggle plus the
 * action-type group dropdown. Both are URL-driven — selecting either pushes a
 * new query string, and the server re-renders the feed's first page — so the
 * current selection always lives in the URL and is shareable.
 */
export function ActivityFilters({ filter, action }: ActivityFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`/activity?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Partner / All toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => pushParams({ filter: "partner" })}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === "partner"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Partner
        </button>
        <button
          onClick={() => pushParams({ filter: "all" })}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
      </div>

      {/* Action-type filter */}
      <Select
        value={action ?? ALL_ACTIONS}
        onValueChange={(val) =>
          pushParams({ action: val === ALL_ACTIONS ? null : val })
        }
      >
        <SelectTrigger className="h-8 w-[150px]">
          <SelectValue>
            {action
              ? ACTIVITY_GROUPS.find((g) => g.slug === action)?.label
              : "All activity"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_ACTIONS}>All activity</SelectItem>
          {ACTIVITY_GROUPS.map((g) => (
            <SelectItem key={g.slug} value={g.slug}>
              {g.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
