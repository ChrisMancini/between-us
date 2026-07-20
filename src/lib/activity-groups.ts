import type { ActivityAction } from "@/lib/models/activity";

/**
 * User-facing groupings for the activity feed's action-type filter. The feed's
 * many action types would overwhelm a filter shown individually, so they collapse
 * into these six categories. The order here is the order the groups appear in the
 * filter dropdown; the groupings mirror the color scheme in `activity-glyph.ts`.
 * The coverage test guarantees every action type belongs to exactly one group.
 *
 * A slug is the URL value (`?action=expenses`) and the Zod enum member — kept as a
 * literal tuple so `z.enum` and the `ActivityGroupSlug` type stay in lockstep.
 */
export const ACTIVITY_GROUP_SLUGS = [
  "expenses",
  "settlements",
  "recurring",
  "payments",
  "readiness",
  "import",
] as const;

export type ActivityGroupSlug = (typeof ACTIVITY_GROUP_SLUGS)[number];

interface ActivityGroup {
  slug: ActivityGroupSlug;
  label: string;
  actions: ActivityAction[];
}

export const ACTIVITY_GROUPS: ActivityGroup[] = [
  {
    slug: "expenses",
    label: "Expenses",
    actions: ["expense_create", "expense_edit", "expense_delete"],
  },
  {
    slug: "settlements",
    label: "Settlements",
    actions: ["settlement_close", "settlement_reopen"],
  },
  {
    slug: "recurring",
    label: "Recurring",
    actions: [
      "recurring_apply",
      "recurring_auto_apply",
      "recurring_auto_apply_alert",
    ],
  },
  {
    slug: "payments",
    label: "Payments",
    actions: [
      "action_created",
      "action_paid",
      "action_confirmed",
      "action_cancelled",
    ],
  },
  {
    slug: "readiness",
    label: "Readiness",
    actions: ["expenses_done", "expenses_undone"],
  },
  {
    slug: "import",
    label: "Import",
    actions: ["csv_import"],
  },
];

/**
 * The action types behind a group slug, or `undefined` if the slug is unknown.
 * Callers that receive a Zod-validated slug can rely on a defined result.
 */
export function actionsForGroup(
  slug: string
): ActivityAction[] | undefined {
  return ACTIVITY_GROUPS.find((g) => g.slug === slug)?.actions;
}
