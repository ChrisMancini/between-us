import { z } from "zod";

// API contract — amount in cents (integer).
export const expenseApiSchema = z.object({
  paidBy:         z.string().min(1),
  date:           z.string().min(1),
  tagIds:         z.array(z.string().min(1)).min(1, "At least one tag is required"),
  amount:         z.number().int().min(1),
  where:          z.string().min(1).max(100),
  notes:          z.string().max(500).optional(),
  splitType:      z.enum(["split", "full"]),
  settlementType: z.enum(["immediate", "deferred"]),
});

export type ExpenseApiInput = z.infer<typeof expenseApiSchema>;

export const expenseUpdateApiSchema = expenseApiSchema.omit({ paidBy: true });

export const expenseQuerySchema = z.object({
  month: z
    .union([z.literal("all"), z.coerce.number().int().min(1).max(12)])
    .optional()
    .transform((v) => (v === "all" ? null : (v ?? null))),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  q: z.string().max(200).optional().default(""),
  tag: z.string().max(200).optional().default(""),
  paidBy: z.string().max(100).optional().default(""),
  offset: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});
