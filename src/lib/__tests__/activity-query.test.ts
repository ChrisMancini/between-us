import { buildActivityQuery } from "@/lib/activity-query";

describe("buildActivityQuery", () => {
  it("scopes to the partner (excludes the current user) by default", () => {
    const q = buildActivityQuery({
      filter: "partner",
      action: null,
      currentUserKey: "chris",
    });
    expect(q).toEqual({ actorKey: { $ne: "chris" } });
  });

  it("does not scope actorKey when filter is all", () => {
    const q = buildActivityQuery({
      filter: "all",
      action: null,
      currentUserKey: "chris",
    });
    expect(q.actorKey).toBeUndefined();
  });

  it("constrains action to the group's types", () => {
    const q = buildActivityQuery({
      filter: "all",
      action: "settlements",
      currentUserKey: "chris",
    });
    expect(q.action).toEqual({
      $in: ["settlement_close", "settlement_reopen"],
    });
  });

  it("composes partner, action, and cursor together", () => {
    const cursor = "2026-05-01T12:00:00.000Z";
    const q = buildActivityQuery({
      filter: "partner",
      action: "expenses",
      currentUserKey: "chris",
      cursor,
    });
    expect(q).toEqual({
      actorKey: { $ne: "chris" },
      action: { $in: ["expense_create", "expense_edit", "expense_delete"] },
      createdAt: { $lt: new Date(cursor) },
    });
  });
});
