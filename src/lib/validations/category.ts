import { z } from "zod";

export const categoryApiSchema = z.object({
  name: z.string().min(1, "Name is required").max(50).trim(),
  settlementType: z.enum(["immediate", "deferred"]),
});

export type CategoryApiInput = z.infer<typeof categoryApiSchema>;

export const categoryReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export type CategoryReorderInput = z.infer<typeof categoryReorderSchema>;
