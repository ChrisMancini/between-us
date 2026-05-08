import { Activity, type ActivityAction } from "@/lib/models/activity";

export async function logActivity(
  actorKey: string,
  action: ActivityAction,
  summary: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await Activity.create({ action, actorKey, summary, metadata });
  } catch (err) {
    console.error("[logActivity] Failed to log activity:", err);
  }
}
