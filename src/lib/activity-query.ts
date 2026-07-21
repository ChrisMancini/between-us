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
  from?: string | null;
  to?: string | null;
}): Record<string, unknown> {
  const { filter, action, currentUserKey, cursor, from, to } = opts;
  const query: Record<string, unknown> = {};

  if (filter === "partner") {
    query.actorKey = { $ne: currentUserKey };
  }

  if (action) {
    const actions = actionsForGroup(action);
    if (actions) query.action = { $in: actions };
  }

  // `from`/`to` (inclusive range) and `cursor` (forward pagination) all constrain
  // `createdAt`, so they merge into one operator object. `$lt` from the cursor and
  // `$lte` from `to` coexist: whichever is earlier wins, keeping paged results
  // bounded by the range.
  const createdAt: Record<string, Date> = {};
  if (from) createdAt.$gte = new Date(from);
  if (to) createdAt.$lte = new Date(to);
  if (cursor) createdAt.$lt = new Date(cursor);
  if (Object.keys(createdAt).length > 0) {
    query.createdAt = createdAt;
  }

  return query;
}
