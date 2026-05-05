import { z } from "zod";

const csvImportExpenseSchema = z.object({
  paidBy: z.string().min(1),
  date: z.string().min(1),
  categoryId: z.string().min(1),
  amount: z.number().int().min(1),
  where: z.string().min(1).max(100),
  notes: z.string().max(500).optional(),
  splitType: z.enum(["split", "full"]),
});

export const csvImportApiSchema = z.object({
  expenses: z.array(csvImportExpenseSchema).min(1).max(500),
});

export type CsvImportApiInput = z.infer<typeof csvImportApiSchema>;
