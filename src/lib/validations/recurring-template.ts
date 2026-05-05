import { z } from "zod";

const recurringTemplateItemSchema = z.object({
  paidBy: z.string().min(1),
  categoryId: z.string().min(1),
  amount: z.number().int().min(1),
  where: z.string().min(1).max(100),
  notes: z.string().max(500).optional(),
  splitType: z.enum(["split", "full"]),
});

export const recurringTemplateApiSchema = z.object({
  name: z.string().min(1).max(100),
  items: z.array(recurringTemplateItemSchema).min(1),
});

export type RecurringTemplateApiInput = z.infer<
  typeof recurringTemplateApiSchema
>;

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

export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;
