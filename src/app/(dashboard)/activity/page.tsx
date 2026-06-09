import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Activity, type IActivity } from "@/lib/models/activity";
import { ActivityFeed } from "./_components/activity-feed";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const session = await auth();
  if (!session) redirect("/login");

  await connectToDatabase();

  const results = await Activity.find({
    actorKey: { $ne: session.user.paidByKey },
  })
    .sort({ createdAt: -1 })
    .limit(21)
    .lean<IActivity[]>();

  const hasMore = results.length > 20;
  const items = results.slice(0, 20);

  const activities = items.map((a) => ({
    _id: a._id.toString(),
    action: a.action,
    actorKey: a.actorKey,
    summary: a.summary,
    metadata: JSON.parse(JSON.stringify(a.metadata ?? {})) as Record<string, unknown>,
    createdAt: (a.createdAt as Date).toISOString(),
  }));

  const nextCursor = hasMore
    ? activities[activities.length - 1].createdAt
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          See what your partner has been up to
        </p>
      </div>

      <ActivityFeed initialItems={activities} initialCursor={nextCursor} />
    </div>
  );
}
