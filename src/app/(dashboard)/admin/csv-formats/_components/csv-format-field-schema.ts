import { z } from "zod";

export const csvFormatFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  dateColumn: z.string().min(1, "Date column is required").max(100),
  dateFormat: z.enum(["MM/DD/YYYY", "YYYY-MM-DD", "MM-DD-YYYY", "DD/MM/YYYY"]),
  descriptionColumn: z.string().min(1, "Merchant / Location column is required").max(100),
  amountType: z.enum(["separate", "single"]),
  debitColumn: z.string().max(100).optional(),
  creditColumn: z.string().max(100).optional(),
  amountColumn: z.string().max(100).optional(),
  purchaseSign: z.enum(["positive", "negative"]).optional(),
  tagColumn: z.string().max(100).optional(),
  notesColumn: z.string().max(100).optional(),
  tagMappings: z
    .array(
      z.object({
        sourceValue: z.string().min(1, "Source value is required"),
        tagIds: z.array(z.string()).min(1, "At least one tag is required"),
      })
    )
    .optional(),
});

export type CsvFormatFormValues = z.infer<typeof csvFormatFormSchema>;
