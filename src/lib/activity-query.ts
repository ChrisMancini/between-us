import { actionsForGroup, type ActivityGroupSlug } from "@/lib/activity-groups";

/**
 * Builds the MongoDB filter for an activity-feed query. Shared by the server
 * page (initial render) and the `/api/activity` route (Load More / polling) so
 * the two never drift on how the Partner/All and action-group filters map to a
 * query — mirroring how expenses centralise `buildExpenseQuery`.
 */
export function buildActivityQuery(opts: {
  filter: "partner" | "all";
  action: ActivityGroupSlug | null;
  currentUserKey: string;
  cursor?: string | null;
}): Record<string, unknown> {
  const { filter, action, currentUserKey, cursor } = opts;
  const query: Record<string, unknown> = {};

  if (filter === "partner") {
    query.actorKey = { $ne: currentUserKey };
  }

  if (action) {
    const actions = actionsForGroup(action);
    if (actions) query.action = { $in: actions };
  }

  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  return query;
}
