import { asMock } from "@/test/api-helpers";

jest.mock("@/lib/models/expense", () => ({ Expense: { insertMany: jest.fn() } }));
jest.mock("@/lib/models/recurring-template", () => ({
  RecurringTemplate: { updateOne: jest.fn() },
}));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));
jest.mock("@/lib/readiness-reset", () => ({ resetReadinessForMonths: jest.fn() }));
jest.mock("@/lib/action-lifecycle", () => ({
  createActionForExpense: jest.fn().mockResolvedValue(null),
  getOtherPersonKey: jest.fn().mockResolvedValue("jane"),
}));

import { Expense } from "@/lib/models/expense";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { logActivity } from "@/lib/activity-logger";
import { resetReadinessForMonths } from "@/lib/readiness-reset";
import { createActionForExpense } from "@/lib/action-lifecycle";
import { applyTemplateCore } from "@/lib/recurring-apply-core";

const DATE = new Date(Date.UTC(2026, 6, 10));

const baseItem = {
  paidBy: "john",
  tagIds: ["tag-1"],
  amount: 10000,
  where: "FPL",
  notes: "Electric",
  splitType: "split" as const,
  settlementType: "deferred" as const,
};

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    templateId: "tmpl-1",
    templateName: "Monthly Bills",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: [baseItem] as any,
    amounts: [10000],
    pathById: new Map([["tag-1", "Bills/Electric"]]),
    date: DATE,
    actorKey: "john",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  asMock(RecurringTemplate.updateOne).mockResolvedValue({});
});

describe("applyTemplateCore", () => {
  it("inserts expenses from the given amounts and bumps template bookkeeping", async () => {
    asMock(Expense.insertMany).mockResolvedValue([
      { _id: "e1", settlementType: "deferred" },
    ]);

    const { count } = await applyTemplateCore(baseInput({ amounts: [12345] }));

    expect(count).toBe(1);
    const inserted = asMock(Expense.insertMany).mock.calls[0][0];
    expect(inserted[0]).toMatchObject({ amount: 12345, date: DATE, where: "FPL" });
    expect(RecurringTemplate.updateOne).toHaveBeenCalledWith(
      { _id: "tmpl-1" },
      { $set: { lastAppliedAt: expect.any(Date) }, $inc: { applyCount: 1 } }
    );
    expect(resetReadinessForMonths).toHaveBeenCalledWith("john", [DATE]);
  });

  it("creates a confirmation Action for immediate items only", async () => {
    asMock(Expense.insertMany).mockResolvedValue([
      { _id: "e1", settlementType: "immediate", paidBy: "john" },
      { _id: "e2", settlementType: "deferred", paidBy: "john" },
    ]);

    await applyTemplateCore(baseInput());

    expect(createActionForExpense).toHaveBeenCalledTimes(1);
    expect(asMock(createActionForExpense).mock.calls[0][0]).toMatchObject({
      _id: "e1",
      settlementType: "immediate",
    });
  });

  it("does not create Actions when all items are deferred", async () => {
    asMock(Expense.insertMany).mockResolvedValue([
      { _id: "e1", settlementType: "deferred" },
      { _id: "e2", settlementType: "deferred" },
    ]);

    await applyTemplateCore(baseInput());

    expect(createActionForExpense).not.toHaveBeenCalled();
  });

  it("logs a manual recurring_apply activity by default", async () => {
    asMock(Expense.insertMany).mockResolvedValue([{ _id: "e1", settlementType: "deferred" }]);

    await applyTemplateCore(baseInput());

    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "recurring_apply",
      expect.stringContaining('applied "Monthly Bills"'),
      expect.objectContaining({ templateId: "tmpl-1", count: 1 })
    );
  });

  it("logs a recurring_auto_apply activity when auto is set", async () => {
    asMock(Expense.insertMany).mockResolvedValue([{ _id: "e1", settlementType: "deferred" }]);

    await applyTemplateCore(baseInput({ auto: true }));

    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "recurring_auto_apply",
      expect.stringContaining('auto-applied "Monthly Bills"'),
      expect.objectContaining({ templateId: "tmpl-1", count: 1 })
    );
  });

  it("reports added and skipped counts when items were skipped", async () => {
    asMock(Expense.insertMany).mockResolvedValue([{ _id: "e1", settlementType: "deferred" }]);

    await applyTemplateCore(
      baseInput({
        auto: true,
        skipped: [{ where: "Water Co", reason: "duplicate" }],
      })
    );

    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "recurring_auto_apply",
      expect.stringContaining("(1 added, 1 skipped)"),
      expect.objectContaining({
        count: 1,
        skippedCount: 1,
        skipped: [{ where: "Water Co", reason: "duplicate" }],
      })
    );
  });

  it("reports flagged counts for deleted-tag items", async () => {
    asMock(Expense.insertMany).mockResolvedValue([
      { _id: "e1", settlementType: "deferred" },
    ]);

    await applyTemplateCore(
      baseInput({
        auto: true,
        skipped: [{ where: "Water Co", reason: "deleted_tag" }],
      })
    );

    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "recurring_auto_apply",
      expect.stringContaining("(1 added, 1 flagged)"),
      expect.objectContaining({ count: 1, skippedCount: 1, flaggedCount: 1 })
    );
  });

  it("reports skipped and flagged separately when both occur", async () => {
    asMock(Expense.insertMany).mockResolvedValue([
      { _id: "e1", settlementType: "deferred" },
    ]);

    await applyTemplateCore(
      baseInput({
        auto: true,
        skipped: [
          { where: "FPL", reason: "duplicate" },
          { where: "Water Co", reason: "deleted_tag" },
        ],
      })
    );

    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "recurring_auto_apply",
      expect.stringContaining("(1 added, 1 skipped, 1 flagged)"),
      expect.objectContaining({ skippedCount: 2, flaggedCount: 1 })
    );
  });

  it("writes an activity entry and creates nothing when every item was skipped", async () => {
    const { count } = await applyTemplateCore(
      baseInput({
        auto: true,
        items: [],
        amounts: [],
        skipped: [
          { where: "FPL", reason: "duplicate" },
          { where: "Water Co", reason: "duplicate" },
        ],
      })
    );

    expect(count).toBe(0);
    expect(Expense.insertMany).not.toHaveBeenCalled();
    expect(RecurringTemplate.updateOne).not.toHaveBeenCalled();
    expect(resetReadinessForMonths).not.toHaveBeenCalled();
    expect(createActionForExpense).not.toHaveBeenCalled();
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "recurring_auto_apply",
      expect.stringContaining("(0 added, 2 skipped)"),
      expect.objectContaining({ count: 0, skippedCount: 2 })
    );
  });
});
