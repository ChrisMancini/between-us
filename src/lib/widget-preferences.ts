export const WIDGET_IDS = [
  "actions",
  "settlement-status",
  "activity",
  "shortcuts",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export interface WidgetPreference {
  widgetId: WidgetId;
  collapsed: boolean;
}

export function mergeWidgetPreferences(
  saved: Array<{ widgetId: string; collapsed: boolean }> | undefined | null,
  knownIds: readonly string[] = WIDGET_IDS
): WidgetPreference[] {
  if (!saved || saved.length === 0) {
    return knownIds.map((id) => ({ widgetId: id as WidgetId, collapsed: false }));
  }

  const knownSet = new Set(knownIds);
  const seen = new Set<string>();
  const result: WidgetPreference[] = [];

  for (const entry of saved) {
    if (knownSet.has(entry.widgetId) && !seen.has(entry.widgetId)) {
      seen.add(entry.widgetId);
      result.push({
        widgetId: entry.widgetId as WidgetId,
        collapsed: entry.collapsed,
      });
    }
  }

  for (const id of knownIds) {
    if (!seen.has(id)) {
      result.push({ widgetId: id as WidgetId, collapsed: false });
    }
  }

  return result;
}
