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

  it("applies a lower bound with from", () => {
    const from = "2026-05-01T00:00:00.000Z";
    const q = buildActivityQuery({
      filter: "all",
      action: null,
      currentUserKey: "chris",
      from,
    });
    expect(q.createdAt).toEqual({ $gte: new Date(from) });
  });

  it("applies an upper bound with to", () => {
    const to = "2026-05-31T23:59:59.999Z";
    const q = buildActivityQuery({
      filter: "all",
      action: null,
      currentUserKey: "chris",
      to,
    });
    expect(q.createdAt).toEqual({ $lte: new Date(to) });
  });

  it("merges from and to into a single createdAt range", () => {
    const from = "2026-05-01T00:00:00.000Z";
    const to = "2026-05-31T23:59:59.999Z";
    const q = buildActivityQuery({
      filter: "all",
      action: null,
      currentUserKey: "chris",
      from,
      to,
    });
    expect(q.createdAt).toEqual({
      $gte: new Date(from),
      $lte: new Date(to),
    });
  });

  it("merges cursor with the date range so pagination stays bounded", () => {
    const from = "2026-05-01T00:00:00.000Z";
    const to = "2026-05-31T23:59:59.999Z";
    const cursor = "2026-05-15T12:00:00.000Z";
    const q = buildActivityQuery({
      filter: "all",
      action: null,
      currentUserKey: "chris",
      from,
      to,
      cursor,
    });
    expect(q.createdAt).toEqual({
      $gte: new Date(from),
      $lte: new Date(to),
      $lt: new Date(cursor),
    });
  });

  it("omits createdAt entirely when no cursor or range is given", () => {
    const q = buildActivityQuery({
      filter: "all",
      action: null,
      currentUserKey: "chris",
    });
    expect(q.createdAt).toBeUndefined();
  });
});
