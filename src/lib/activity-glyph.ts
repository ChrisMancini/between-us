import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  RotateCcw,
  Repeat,
  CalendarClock,
  CalendarX,
  FileUp,
  CircleDollarSign,
  Send,
  CheckCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ActivityAction } from "@/lib/models/activity";

/**
 * Human-readable label for an activity's glyph — the color-blind-safe text that
 * rides alongside the icon shape (title + aria-label), so the two auto-apply
 * variants read without relying on color. Undefined for actions whose summary
 * text already says everything.
 */
export function activityGlyphLabel(
  action: ActivityAction | string
): string | undefined {
  switch (action) {
    case "recurring_auto_apply_alert":
      return "Auto-apply alert";
    case "recurring_auto_apply":
      return "Automatic recurring apply";
    default:
      return undefined;
  }
}

/**
 * The icon shape for each activity action. Shared by the full activity feed and
 * the dashboard activity widget so the two never drift apart. The map is total
 * over `ActivityAction`, so a lookup by a typed action is always defined.
 */
export const ACTION_ICONS: Record<ActivityAction, LucideIcon> = {
  expense_create: Plus,
  expense_edit: Pencil,
  expense_delete: Trash2,
  settlement_close: CheckCircle2,
  settlement_reopen: RotateCcw,
  recurring_apply: Repeat,
  recurring_auto_apply: CalendarClock,
  recurring_auto_apply_alert: CalendarX,
  csv_import: FileUp,
  expenses_done: CheckCircle2,
  expenses_undone: Circle,
  action_created: CircleDollarSign,
  action_paid: Send,
  action_confirmed: CheckCheck,
  action_cancelled: XCircle,
};

/**
 * The color pair for each action's glyph, split so both callers can share it:
 * the compact widget applies `text` to a bare inline icon, while the full feed
 * applies `text` + `bg` to render the icon inside a colored chip.
 */
export const ACTION_COLORS: Record<ActivityAction, { text: string; bg: string }> = {
  expense_create: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  expense_edit: { text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40" },
  expense_delete: { text: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40" },
  settlement_close: { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40" },
  settlement_reopen: { text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/40" },
  recurring_apply: { text: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-900/40" },
  recurring_auto_apply: { text: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-900/40" },
  recurring_auto_apply_alert: { text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/40" },
  csv_import: { text: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/40" },
  expenses_done: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  expenses_undone: { text: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-900/40" },
  action_created: { text: "text-teal-600 dark:text-teal-400", bg: "bg-teal-100 dark:bg-teal-900/40" },
  action_paid: { text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40" },
  action_confirmed: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  action_cancelled: { text: "text-slate-500 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-900/40" },
};
