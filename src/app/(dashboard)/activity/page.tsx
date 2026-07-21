import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/db";
import { Activity, type IActivity } from "@/lib/models/activity";
import {
  ACTIVITY_GROUP_SLUGS,
  type ActivityGroupSlug,
} from "@/lib/activity-groups";
import { buildActivityQuery } from "@/lib/activity-query";
import { ActivityFeed } from "./_components/activity-feed";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    filter?: string;
    action?: string;
    from?: string;
    to?: string;
  }>;
}

/** A valid ISO datetime, or `null` for absent/malformed values (degrade quietly). */
function parseDateParam(value: string | undefined): string | null {
  if (!value) return null;
  return z.string().datetime().safeParse(value).success ? value : null;
}

export default async function ActivityPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");

  // Degrade each filter independently: a bad `action` in a hand-edited URL must
  // not also discard a valid `filter`, and vice versa.
  const sp = await searchParams;
  const filter: "partner" | "all" = sp.filter === "all" ? "all" : "partner";
  const action: ActivityGroupSlug | null = (
    ACTIVITY_GROUP_SLUGS as readonly string[]
  ).includes(sp.action ?? "")
    ? (sp.action as ActivityGroupSlug)
    : null;
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to);

  await connectToDatabase();

  const query = buildActivityQuery({
    filter,
    action,
    currentUserKey: session.user.paidByKey,
    from,
    to,
  });

  const results = await Activity.find(query)
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

      <ActivityFeed
        initialItems={activities}
        initialCursor={nextCursor}
        filter={filter}
        action={action}
        from={from}
        to={to}
      />
    </div>
  );
}
