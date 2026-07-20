import {
  ACTIVITY_GROUPS,
  ACTIVITY_GROUP_SLUGS,
  actionsForGroup,
} from "@/lib/activity-groups";

// The full set of action types the feed knows about. Kept in sync with
// ACTIVITY_ACTIONS in the model; the coverage test below fails loudly if a new
// action type is added without slotting it into a filter group.
const ALL_ACTIONS = [
  "expense_create",
  "expense_edit",
  "expense_delete",
  "settlement_close",
  "settlement_reopen",
  "recurring_apply",
  "recurring_auto_apply",
  "recurring_auto_apply_alert",
  "csv_import",
  "expenses_done",
  "expenses_undone",
  "action_created",
  "action_paid",
  "action_confirmed",
  "action_cancelled",
];

describe("activity-groups", () => {
  it("exposes a slug for every group, in order", () => {
    expect(ACTIVITY_GROUPS.map((g) => g.slug)).toEqual([...ACTIVITY_GROUP_SLUGS]);
  });

  it("covers every action type in exactly one group", () => {
    const covered = ACTIVITY_GROUPS.flatMap((g) => g.actions);
    // No duplicates across groups
    expect(new Set(covered).size).toBe(covered.length);
    // Every action is filterable, and no group references an unknown action
    expect([...covered].sort()).toEqual([...ALL_ACTIONS].sort());
  });

  it("resolves a group slug to its action types", () => {
    expect(actionsForGroup("expenses")).toEqual([
      "expense_create",
      "expense_edit",
      "expense_delete",
    ]);
  });

  it("returns undefined for an unknown slug", () => {
    expect(actionsForGroup("nope")).toBeUndefined();
  });
});
