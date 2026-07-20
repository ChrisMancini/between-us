import { z } from "zod";
import { ACTIVITY_GROUP_SLUGS } from "@/lib/activity-groups";

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().datetime().optional(),
  filter: z.enum(["partner", "all"]).default("partner"),
  action: z.enum(ACTIVITY_GROUP_SLUGS).optional(),
});
