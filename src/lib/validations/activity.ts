import { z } from "zod";

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().datetime().optional(),
  filter: z.enum(["partner", "all"]).default("partner"),
});

export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;
