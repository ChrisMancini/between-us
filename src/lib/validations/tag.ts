import { z } from "zod";

export const tagApiSchema = z.object({
  path: z
    .string()
    .min(1, "Tag path is required")
    .max(200)
    .trim()
    .refine(
      (v) => !v.startsWith("/") && !v.endsWith("/"),
      "Path cannot start or end with /"
    )
    .refine(
      (v) => v.split("/").every((s) => s.trim().length > 0),
      "Path contains an empty segment"
    ),
});

export type TagApiInput = z.infer<typeof tagApiSchema>;