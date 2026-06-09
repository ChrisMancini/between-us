import { z } from "zod";

export const actionQuerySchema = z.object({
  status: z
    .enum(["pending", "paid", "confirmed", "cancelled"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ActionQueryInput = z.infer<typeof actionQuerySchema>;
