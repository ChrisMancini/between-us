import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Activity, type IActivity } from "@/lib/models/activity";
import { activityQuerySchema } from "@/lib/validations/activity";
import { withAuth } from "@/lib/auth-guard";
import { validationError } from "@/lib/api-utils";

export const GET = withAuth(async (req, session) => {
  const { searchParams } = new URL(req.url);
  const parsed = activityQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    filter: searchParams.get("filter") ?? undefined,
  });

  if (!parsed.success) return validationError(parsed);

  const { limit, cursor, filter } = parsed.data;

  await connectToDatabase();

  const query: Record<string, unknown> = {};

  if (filter === "partner") {
    query.actorKey = { $ne: session.user.paidByKey };
  }

  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  const results = await Activity.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean<IActivity[]>();

  const hasMore = results.length > limit;
  const items = results.slice(0, limit);

  const activities = items.map((a) => ({
    _id: a._id.toString(),
    action: a.action,
    actorKey: a.actorKey,
    summary: a.summary,
    metadata: a.metadata ?? {},
    createdAt: (a.createdAt as Date).toISOString(),
  }));

  return NextResponse.json({
    activities,
    nextCursor: hasMore
      ? activities[activities.length - 1].createdAt
      : null,
  });
});
