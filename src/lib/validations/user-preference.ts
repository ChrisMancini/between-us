import { z } from "zod";
import { WIDGET_IDS } from "@/lib/widget-preferences";

export const dashboardWidgetPreferencesSchema = z.object({
  widgets: z
    .array(
      z.object({
        widgetId: z.enum(WIDGET_IDS),
        collapsed: z.boolean(),
      })
    )
    .min(1)
    .refine(
      (widgets) => {
        const ids = widgets.map((w) => w.widgetId);
        return new Set(ids).size === ids.length;
      },
      { message: "Duplicate widget IDs are not allowed" }
    ),
});
