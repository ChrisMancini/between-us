"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { WidgetPreference, WidgetId } from "@/lib/widget-preferences";
import type { SerializedActivity } from "@/lib/models/activity";
import type { SerializedAction } from "@/lib/models/action";
import { DashboardWidget } from "./dashboard-widget";
import { SettlementStatusCard } from "./settlement-status-card";
import { ActivityWidget } from "./activity-widget";
import { Shortcuts } from "./shortcuts";
import { ActionsWidget } from "./actions-widget";

interface SettlementProps {
  monthLabel: string;
  isClosed: boolean;
  netOwedBy: string;
  netAmount: number;
  unsettledMonthCount: number;
}

interface DashboardWidgetColumnProps {
  widgetPreferences: WidgetPreference[];
  settlementProps: SettlementProps;
  activities: SerializedActivity[];
  actions: SerializedAction[];
  currentUserKey: string;
}

const WIDGET_TITLES: Record<string, string> = {
  actions: "Actions",
  "settlement-status": "Settlement",
  activity: "Partner Activity",
  shortcuts: "Shortcuts",
};

export function DashboardWidgetColumn({
  widgetPreferences,
  settlementProps,
  activities,
  actions,
  currentUserKey,
}: DashboardWidgetColumnProps) {
  const [preferences, setPreferences] =
    useState<WidgetPreference[]>(widgetPreferences);
  const [isDragActive, setIsDragActive] = useState(false);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const savePreferences = useCallback((updated: WidgetPreference[]) => {
    fetch("/api/user-preferences/dashboard", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgets: updated }),
    });
  }, []);

  function handleDragStart() {
    setIsDragActive(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    setIsDragActive(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPreferences((prev) => {
      const oldIndex = prev.findIndex((w) => w.widgetId === active.id);
      const newIndex = prev.findIndex((w) => w.widgetId === over.id);
      const updated = arrayMove(prev, oldIndex, newIndex);
      savePreferences(updated);
      return updated;
    });
  }

  function handleToggleCollapse(widgetId: WidgetId) {
    setPreferences((prev) => {
      const updated = prev.map((w) =>
        w.widgetId === widgetId ? { ...w, collapsed: !w.collapsed } : w
      );
      savePreferences(updated);
      return updated;
    });
  }

  function renderWidgetContent(widgetId: WidgetId) {
    switch (widgetId) {
      case "actions":
        return (
          <ActionsWidget actions={actions} currentUserKey={currentUserKey} />
        );
      case "settlement-status":
        return <SettlementStatusCard {...settlementProps} />;
      case "activity":
        return <ActivityWidget activities={activities} />;
      case "shortcuts":
        return <Shortcuts />;
      default:
        return null;
    }
  }

  const visibleWidgets = preferences.filter(
    (w) => WIDGET_TITLES[w.widgetId] !== undefined
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setIsDragActive(false)}
    >
      <SortableContext
        items={visibleWidgets.map((w) => w.widgetId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-6">
          {visibleWidgets.map((widget) => {
            const title =
              widget.widgetId === "settlement-status"
                ? `Settlement — ${settlementProps.monthLabel}`
                : WIDGET_TITLES[widget.widgetId];

            return (
              <DashboardWidget
                key={widget.widgetId}
                id={widget.widgetId}
                title={title}
                collapsed={widget.collapsed}
                isDragActive={isDragActive}
                badge={widget.widgetId === "actions" ? actions.length : undefined}
                onToggleCollapse={() =>
                  handleToggleCollapse(widget.widgetId)
                }
              >
                {renderWidgetContent(widget.widgetId)}
              </DashboardWidget>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
