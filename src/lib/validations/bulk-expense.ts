import { z } from "zod";

export const bulkExpenseUpdateSchema = z
  .object({
    expenseIds: z.array(z.string().min(1)).min(1).max(500),
    tags: z
      .object({
        mode: z.enum(["replace", "add", "remove"]),
        tagIds: z.array(z.string().min(1)).min(1),
      })
      .optional(),
    splitType: z.enum(["split", "full"]).optional(),
    settlementType: z.enum(["immediate", "deferred"]).optional(),
  })
  .refine(
    (data) =>
      data.tags !== undefined ||
      data.splitType !== undefined ||
      data.settlementType !== undefined,
    { message: "At least one field (tags, splitType, or settlementType) must be provided" },
  );

export const bulkExpenseDeleteSchema = z.object({
  expenseIds: z.array(z.string().min(1)).min(1).max(500),
});

