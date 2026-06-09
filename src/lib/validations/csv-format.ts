import { z } from "zod";

const tagMappingSchema = z.object({
  sourceValue: z.string().min(1, "Source value is required").max(100).trim(),
  tagIds: z.array(z.string().min(1)).min(1, "At least one tag is required"),
});

export const csvFormatApiSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100).trim(),
    dateColumn: z.string().min(1, "Date column is required").max(100).trim(),
    dateFormat: z.enum(["MM/DD/YYYY", "YYYY-MM-DD", "MM-DD-YYYY", "DD/MM/YYYY"]),
    descriptionColumn: z.string().min(1, "Description column is required").max(100).trim(),
    amountType: z.enum(["separate", "single"]),
    debitColumn: z.string().max(100).trim().optional(),
    creditColumn: z.string().max(100).trim().optional(),
    amountColumn: z.string().max(100).trim().optional(),
    purchaseSign: z.enum(["positive", "negative"]).optional(),
    tagColumn: z.string().max(100).trim().optional().default(""),
    notesColumn: z.string().max(100).trim().optional().default(""),
    tagMappings: z.array(tagMappingSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.amountType === "separate") {
      if (!data.debitColumn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debit column is required for separate amount type",
          path: ["debitColumn"],
        });
      }
      if (!data.creditColumn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Credit column is required for separate amount type",
          path: ["creditColumn"],
        });
      }
    }
    if (data.amountType === "single") {
      if (!data.amountColumn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount column is required for single amount type",
          path: ["amountColumn"],
        });
      }
      if (!data.purchaseSign) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Purchase sign is required for single amount type",
          path: ["purchaseSign"],
        });
      }
    }
  });
