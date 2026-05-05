import { z } from "zod";

// API contract — amount in cents (integer).
export const expenseApiSchema = z.object({
  paidBy:     z.string().min(1),
  date:       z.string().min(1),
  categoryId: z.string().min(1),
  amount:     z.number().int().min(1),
  where:      z.string().min(1).max(100),
  notes:      z.string().max(500).optional(),
  splitType:  z.enum(["split", "full"]),
});

export type ExpenseApiInput = z.infer<typeof expenseApiSchema>;
