import {
  mergeWidgetPreferences,
  WIDGET_IDS,
} from "../widget-preferences";

describe("mergeWidgetPreferences", () => {
  it("returns default order when saved is undefined", () => {
    const result = mergeWidgetPreferences(undefined);
    expect(result.map((w) => w.widgetId)).toEqual([...WIDGET_IDS]);
    expect(result.every((w) => !w.collapsed)).toBe(true);
  });

  it("returns default order when saved is null", () => {
    const result = mergeWidgetPreferences(null);
    expect(result.map((w) => w.widgetId)).toEqual([...WIDGET_IDS]);
  });

  it("returns default order when saved is empty", () => {
    const result = mergeWidgetPreferences([]);
    expect(result.map((w) => w.widgetId)).toEqual([...WIDGET_IDS]);
  });

  it("preserves saved order and collapsed state", () => {
    const saved = [
      { widgetId: "shortcuts", collapsed: true },
      { widgetId: "activity", collapsed: false },
      { widgetId: "settlement-status", collapsed: true },
      { widgetId: "actions", collapsed: false },
    ];
    const result = mergeWidgetPreferences(saved);
    expect(result).toEqual([
      { widgetId: "shortcuts", collapsed: true },
      { widgetId: "activity", collapsed: false },
      { widgetId: "settlement-status", collapsed: true },
      { widgetId: "actions", collapsed: false },
    ]);
  });

  it("strips unknown widget IDs", () => {
    const saved = [
      { widgetId: "activity", collapsed: false },
      { widgetId: "removed-widget", collapsed: true },
      { widgetId: "shortcuts", collapsed: false },
    ];
    const result = mergeWidgetPreferences(saved);
    expect(result.map((w) => w.widgetId)).toEqual([
      "activity",
      "shortcuts",
      "actions",
      "settlement-status",
    ]);
  });

  it("appends new unsaved widgets at bottom in default order", () => {
    const saved = [
      { widgetId: "shortcuts", collapsed: true },
    ];
    const result = mergeWidgetPreferences(saved);
    expect(result).toEqual([
      { widgetId: "shortcuts", collapsed: true },
      { widgetId: "actions", collapsed: false },
      { widgetId: "settlement-status", collapsed: false },
      { widgetId: "activity", collapsed: false },
    ]);
  });

  it("handles duplicate widget IDs by keeping the first occurrence", () => {
    const saved = [
      { widgetId: "activity", collapsed: true },
      { widgetId: "activity", collapsed: false },
      { widgetId: "shortcuts", collapsed: false },
    ];
    const result = mergeWidgetPreferences(saved);
    const activityEntries = result.filter((w) => w.widgetId === "activity");
    expect(activityEntries).toHaveLength(1);
    expect(activityEntries[0].collapsed).toBe(true);
  });

  it("respects custom knownIds parameter", () => {
    const knownIds = ["settlement-status", "activity"] as const;
    const result = mergeWidgetPreferences(undefined, knownIds);
    expect(result.map((w) => w.widgetId)).toEqual([
      "settlement-status",
      "activity",
    ]);
  });
});
