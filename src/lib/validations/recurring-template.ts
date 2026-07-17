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

// Discriminated union over all five schedule families (ADR-0018, decision 2).
const weekendAdjustment = z.enum(["none", "next_weekday"]).optional();
const weekOrdinal = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal("last"),
]);
const semiMonthlyDay = z.union([
  z.number().int().min(1).max(31),
  z.literal("last"),
]);

const scheduleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("day_of_month"),
    day: z.number().int().min(1).max(31),
    weekendAdjustment,
  }),
  z.object({
    type: z.literal("last_day_of_month"),
    weekendAdjustment,
  }),
  z.object({
    type: z.literal("nth_weekday"),
    ordinal: weekOrdinal,
    weekday: z.number().int().min(0).max(6),
    weekendAdjustment,
  }),
  z.object({
    type: z.literal("semi_monthly"),
    days: z
      .tuple([semiMonthlyDay, semiMonthlyDay])
      .refine((d) => d[0] !== d[1], {
        message: "The two semi-monthly days must differ",
      }),
    weekendAdjustment,
  }),
  z.object({
    type: z.literal("every_n_weeks"),
    interval: z.number().int().min(1).max(52),
    anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid anchor date"),
    weekendAdjustment,
  }),
]);

export const recurringTemplateApiSchema = z
  .object({
    name: z.string().min(1).max(100),
    items: z.array(recurringTemplateItemSchema).min(1),
    autoApplyEnabled: z.boolean().optional().default(false),
    schedule: scheduleSchema.nullable().optional(),
  })
  .refine((d) => !d.autoApplyEnabled || d.schedule != null, {
    message: "A schedule is required when auto-apply is enabled",
    path: ["schedule"],
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
