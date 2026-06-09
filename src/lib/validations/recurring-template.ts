import { z } from "zod";

const recurringTemplateItemSchema = z.object({
  paidBy: z.string().min(1),
  tagIds: z.array(z.string().min(1)).min(1, "At least one tag is required"),
  amount: z.number().int().min(1),
  where: z.string().min(1).max(100),
  notes: z.string().max(500).optional(),
  splitType: z.enum(["split", "full"]),
  settlementType: z.enum(["immediate", "deferred"]),
});

export const recurringTemplateApiSchema = z.object({
  name: z.string().min(1).max(100),
  items: z.array(recurringTemplateItemSchema).min(1),
});

export const applyTemplateSchema = z.object({
  date: z.string().min(1),
  items: z
    .array(
      z.object({
        amount: z.number().int().min(1),
      })
    )
    .min(1),
});
