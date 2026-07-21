import { z } from "zod";
import { ACTIVITY_GROUP_SLUGS } from "@/lib/activity-groups";

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().datetime().optional(),
  filter: z.enum(["partner", "all"]).default("partner"),
  action: z.enum(ACTIVITY_GROUP_SLUGS).optional(),
  // Inclusive date-range bounds on `createdAt`. The client sends start-of-day
  // (`from`) and end-of-day (`to`) as ISO datetimes so the window respects the
  // user's local timezone; both are optional so an absent range means "all time".
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
