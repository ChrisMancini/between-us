import { z } from "zod";

export const expenseFieldSchema = z.object({
  date:           z.string().min(1, "Date is required"),
  tagIds:         z.array(z.string().min(1)).min(1, "At least one tag is required"),
  amount:         z
    .string()
    .min(1, "Amount is required")
    .refine(
      (v) => /^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) > 0,
      "Enter a valid amount (e.g. 42.50)"
    ),
  where:          z.string().min(1, "Required").max(100),
  notes:          z.string().max(500).optional(),
  splitType:      z.enum(["split", "full"]),
  settlementType: z.enum(["immediate", "deferred"]),
});

export type ExpenseFieldValues = z.infer<typeof expenseFieldSchema>;
