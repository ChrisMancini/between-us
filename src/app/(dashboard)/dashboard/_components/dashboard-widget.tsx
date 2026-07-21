"use client";

import { useId, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardWidgetProps {
  id: string;
  title: string;
  collapsed: boolean;
  isDragActive: boolean;
  badge?: number;
  indicatorDot?: string;
  onToggleCollapse: () => void;
  children: ReactNode;
}

export function DashboardWidget({
  id,
  title,
  collapsed,
  isDragActive,
  badge,
  indicatorDot,
  onToggleCollapse,
  children,
}: DashboardWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const headingId = useId();
  const contentId = useId();

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="group"
      aria-labelledby={headingId}
      className={`rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center border-b border-primary/10 bg-primary/5 px-5 py-3">
        <button
          type="button"
          className="hidden lg:flex -ml-1 mr-2 cursor-grab touch-none items-center text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${title}`}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <h2
          id={headingId}
          className="flex-1 text-xs font-semibold uppercase tracking-wide text-primary/70"
        >
          {title}
          {collapsed && badge != null && badge > 0 && (
            <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground align-text-top">
              {badge}
            </span>
          )}
          {collapsed && indicatorDot && (
            <span
              className={cn(
                "ml-2 inline-block h-2.5 w-2.5 rounded-full",
                indicatorDot
              )}
            />
          )}
        </h2>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          aria-expanded={!collapsed}
          aria-controls={contentId}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              collapsed ? "-rotate-90" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        id={contentId}
        inert={collapsed || undefined}
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
      >
        <div className={`overflow-hidden ${isDragActive ? "pointer-events-none" : ""}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
