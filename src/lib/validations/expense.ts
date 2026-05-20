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
export type ExpenseUpdateApiInput = z.infer<typeof expenseUpdateApiSchema>;
