import { asMock } from "@/test/api-helpers";

jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/recurring-template", () => ({
  RecurringTemplate: { find: jest.fn() },
}));
jest.mock("@/lib/models/recurring-apply-log", () => ({
  RecurringApplyLog: { findOneAndUpdate: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("@/lib/models/tag", () => ({ Tag: { find: jest.fn() } }));
jest.mock("@/lib/models/expense", () => ({ Expense: { find: jest.fn() } }));
jest.mock("@/lib/persons", () => ({ getPersons: jest.fn() }));
jest.mock("@/lib/settlement-guard", () => ({ areMonthsSettled: jest.fn() }));
jest.mock("@/lib/recurring-apply-core", () => ({ applyTemplateCore: jest.fn() }));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));

import { RecurringTemplate } from "@/lib/models/recurring-template";
import { RecurringApplyLog } from "@/lib/models/recurring-apply-log";
import { Tag } from "@/lib/models/tag";
import { Expense } from "@/lib/models/expense";
import { getPersons } from "@/lib/persons";
import { areMonthsSettled } from "@/lib/settlement-guard";
import { applyTemplateCore } from "@/lib/recurring-apply-core";
import { logActivity } from "@/lib/activity-logger";
import { runScheduler, STALE_CLAIM_TIMEOUT_MS } from "@/lib/recurring-runner";

const utc = (y: number, m: number, d: number, h = 0) =>
  new Date(Date.UTC(y, m - 1, d, h));

const PERSONS = [
  { _id: "user-1", key: "john" },
  { _id: "user-2", key: "jane" },
];

function makeAutoTemplate(overrides: Record<string, unknown> = {}) {
  return {
    _id: "tmpl-1",
    name: "Monthly Bills",
    createdBy: "user-1",
    items: [
      {
        paidBy: "john",
        tagIds: ["tag-1"],
        amount: 10000,
        where: "FPL",
        notes: "Electric",
        splitType: "split",
        settlementType: "deferred",
      },
    ],
    autoApplyEnabled: true,
    autoApplyEnabledAt: utc(2026, 7, 1),
    schedule: { type: "day_of_month", day: 10 },
    ...overrides,
  };
}

function mockTemplates(templates: unknown[]) {
  asMock(RecurringTemplate.find).mockReturnValue({
    lean: jest.fn().mockResolvedValue(templates),
  });
}

function mockExistingExpenses(expenses: unknown[]) {
  asMock(Expense.find).mockReturnValue({
    lean: jest.fn().mockResolvedValue(expenses),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  asMock(getPersons).mockResolvedValue(PERSONS);
  asMock(areMonthsSettled).mockResolvedValue(false);
  asMock(Tag.find).mockReturnValue({
    lean: jest.fn().mockResolvedValue([{ _id: "tag-1", path: "Bills/Electric" }]),
  });
  // Default: no existing expenses near any occurrence (nothing to duplicate-skip).
  mockExistingExpenses([]);
  // Default: claim is won (no pre-existing ledger doc).
  asMock(RecurringApplyLog.findOneAndUpdate).mockResolvedValue(null);
  asMock(RecurringApplyLog.updateOne).mockResolvedValue({});
  asMock(applyTemplateCore).mockResolvedValue({ count: 1, expenses: [] });
});

describe("runScheduler", () => {
  it("does nothing when there are no auto-apply templates", async () => {
    mockTemplates([]);
    const result = await runScheduler(utc(2026, 7, 15));
    expect(result.templatesProcessed).toBe(0);
    expect(applyTemplateCore).not.toHaveBeenCalled();
  });

  it("applies a due occurrence from stored amounts, dated to the occurrence", async () => {
    mockTemplates([makeAutoTemplate()]);

    const result = await runScheduler(utc(2026, 7, 15));

    expect(applyTemplateCore).toHaveBeenCalledTimes(1);
    expect(applyTemplateCore).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: "tmpl-1",
        amounts: [10000],
        date: utc(2026, 7, 10),
        actorKey: "john",
        auto: true,
      })
    );
    expect(result.occurrencesApplied).toBe(1);
    expect(result.expensesCreated).toBe(1);
    expect(RecurringApplyLog.updateOne).toHaveBeenCalledWith(
      { templateId: "tmpl-1", occurrenceDate: utc(2026, 7, 10) },
      { $set: { status: "completed", completedAt: utc(2026, 7, 15), addedCount: 1 } }
    );
  });

  it("does not apply an occurrence that is already claimed", async () => {
    mockTemplates([makeAutoTemplate()]);
    // Pre-existing ledger doc → claim lost.
    asMock(RecurringApplyLog.findOneAndUpdate).mockResolvedValue({
      _id: "log-1",
      status: "completed",
    });

    const result = await runScheduler(utc(2026, 7, 15));

    expect(applyTemplateCore).not.toHaveBeenCalled();
    expect(result.occurrencesApplied).toBe(0);
    expect(result.occurrencesSkipped).toBe(1);
  });

  it("treats a duplicate-key claim race as already claimed", async () => {
    mockTemplates([makeAutoTemplate()]);
    asMock(RecurringApplyLog.findOneAndUpdate).mockRejectedValue({ code: 11000 });

    const result = await runScheduler(utc(2026, 7, 15));

    expect(applyTemplateCore).not.toHaveBeenCalled();
    expect(result.occurrencesSkipped).toBe(1);
  });

  it("backfills occurrences missed during downtime, each dated to its occurrence", async () => {
    mockTemplates([makeAutoTemplate({ autoApplyEnabledAt: utc(2026, 5, 1) })]);

    const result = await runScheduler(utc(2026, 7, 15));

    expect(applyTemplateCore).toHaveBeenCalledTimes(3);
    const dates = asMock(applyTemplateCore).mock.calls.map((c) => c[0].date);
    expect(dates).toEqual([utc(2026, 5, 10), utc(2026, 6, 10), utc(2026, 7, 10)]);
    expect(result.occurrencesApplied).toBe(3);
  });

  it("never invents occurrences dated before enablement", async () => {
    // Enabled on the 10th at 2pm — that day's occurrence is before enablement.
    mockTemplates([
      makeAutoTemplate({ autoApplyEnabledAt: utc(2026, 7, 10, 14) }),
    ]);

    const result = await runScheduler(utc(2026, 8, 31));

    expect(applyTemplateCore).toHaveBeenCalledTimes(1);
    expect(asMock(applyTemplateCore).mock.calls[0][0].date).toEqual(
      utc(2026, 8, 10)
    );
    expect(result.occurrencesApplied).toBe(1);
  });

  it("skips occurrences that fall in a settled month and raises an alert", async () => {
    mockTemplates([makeAutoTemplate({ autoApplyEnabledAt: utc(2026, 6, 1) })]);
    // June is settled, July is open.
    asMock(areMonthsSettled).mockImplementation(
      async (dates: Date[]) => dates[0].getUTCMonth() === 5
    );

    const result = await runScheduler(utc(2026, 7, 15));

    // July still applies; June does not.
    expect(applyTemplateCore).toHaveBeenCalledTimes(1);
    expect(asMock(applyTemplateCore).mock.calls[0][0].date).toEqual(
      utc(2026, 7, 10)
    );
    expect(result.occurrencesApplied).toBe(1);
    expect(result.occurrencesSkipped).toBe(1);
    expect(result.alertsRaised).toBe(1);

    // A settled-month alert names the month, states the recovery (the occurrence
    // is marked done and won't retry), and is itself marked done so it won't re-alert.
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "recurring_auto_apply_alert",
      expect.stringContaining("June 2026 is already settled"),
      expect.objectContaining({
        templateId: "tmpl-1",
        month: 6,
        year: 2026,
        reason: "settled_month",
      })
    );
    expect(asMock(logActivity).mock.calls[0][2]).toContain(
      "Reopen the month and apply this template by hand"
    );
    expect(RecurringApplyLog.updateOne).toHaveBeenCalledWith(
      { templateId: "tmpl-1", occurrenceDate: utc(2026, 6, 10) },
      { $set: { status: "completed", completedAt: utc(2026, 7, 15), addedCount: 0 } }
    );
  });

  it("skips a deleted-tag item, applies its siblings, and flags it", async () => {
    mockTemplates([
      makeAutoTemplate({
        items: [
          {
            paidBy: "john",
            tagIds: ["tag-1"],
            amount: 10000,
            where: "FPL",
            notes: "Electric",
            splitType: "split",
            settlementType: "deferred",
          },
          {
            paidBy: "john",
            tagIds: ["tag-2"],
            amount: 5000,
            where: "Water Co",
            notes: "Water",
            splitType: "split",
            settlementType: "deferred",
          },
        ],
      }),
    ]);
    // tag-2 was deleted — only tag-1 comes back from the lookup.
    asMock(Tag.find).mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue([{ _id: "tag-1", path: "Bills/Electric" }]),
    });

    const result = await runScheduler(utc(2026, 7, 15));

    const call = asMock(applyTemplateCore).mock.calls[0][0];
    expect(call.items).toHaveLength(1);
    expect(call.items[0].where).toBe("FPL");
    expect(call.skipped).toEqual([{ where: "Water Co", reason: "deleted_tag" }]);
    // The occurrence is still applied and marked done — a retry can't restore the tag.
    expect(result.occurrencesApplied).toBe(1);
    expect(RecurringApplyLog.updateOne).toHaveBeenCalledWith(
      { templateId: "tmpl-1", occurrenceDate: utc(2026, 7, 10) },
      expect.objectContaining({ $set: expect.objectContaining({ status: "completed" }) })
    );
  });

  it("retries an occurrence stuck in claimed past the timeout", async () => {
    mockTemplates([makeAutoTemplate()]);
    const staleClaimedAt = new Date(
      utc(2026, 7, 15).getTime() - STALE_CLAIM_TIMEOUT_MS - 1000
    );
    // First call (upsert attempt) finds a stale claim; second call (the steal) wins.
    asMock(RecurringApplyLog.findOneAndUpdate)
      .mockResolvedValueOnce({ _id: "log-1", status: "claimed", claimedAt: staleClaimedAt })
      .mockResolvedValueOnce({ _id: "log-1", status: "claimed", claimedAt: staleClaimedAt });

    const result = await runScheduler(utc(2026, 7, 15));

    expect(applyTemplateCore).toHaveBeenCalledTimes(1);
    expect(result.occurrencesApplied).toBe(1);
    // The steal targets a still-stale claim and refreshes claimedAt.
    expect(RecurringApplyLog.findOneAndUpdate).toHaveBeenCalledTimes(2);
    const stealCall = asMock(RecurringApplyLog.findOneAndUpdate).mock.calls[1];
    expect(stealCall[0]).toMatchObject({
      templateId: "tmpl-1",
      occurrenceDate: utc(2026, 7, 10),
      status: "claimed",
    });
    expect(stealCall[1]).toEqual({ $set: { claimedAt: utc(2026, 7, 15) } });
  });

  it("does not steal a fresh claim still within the timeout", async () => {
    mockTemplates([makeAutoTemplate()]);
    const recentClaimedAt = new Date(utc(2026, 7, 15).getTime() - 1000);
    asMock(RecurringApplyLog.findOneAndUpdate).mockResolvedValue({
      _id: "log-1",
      status: "claimed",
      claimedAt: recentClaimedAt,
    });

    const result = await runScheduler(utc(2026, 7, 15));

    expect(applyTemplateCore).not.toHaveBeenCalled();
    expect(result.occurrencesApplied).toBe(0);
    expect(result.occurrencesSkipped).toBe(1);
    // Only the initial upsert attempt — no steal on an in-flight claim.
    expect(RecurringApplyLog.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not steal or re-apply a completed occurrence", async () => {
    mockTemplates([makeAutoTemplate()]);
    asMock(RecurringApplyLog.findOneAndUpdate).mockResolvedValue({
      _id: "log-1",
      status: "completed",
      claimedAt: new Date(utc(2026, 7, 15).getTime() - STALE_CLAIM_TIMEOUT_MS - 1000),
    });

    const result = await runScheduler(utc(2026, 7, 15));

    expect(applyTemplateCore).not.toHaveBeenCalled();
    expect(result.occurrencesApplied).toBe(0);
    // A completed doc is never stolen even when older than the timeout.
    expect(RecurringApplyLog.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it("acts as the template owner for attribution", async () => {
    mockTemplates([makeAutoTemplate({ createdBy: "user-2" })]);

    await runScheduler(utc(2026, 7, 15));

    expect(asMock(applyTemplateCore).mock.calls[0][0].actorKey).toBe("jane");
  });

  it("skips an item already entered manually but applies the rest", async () => {
    mockTemplates([
      makeAutoTemplate({
        items: [
          {
            paidBy: "john",
            tagIds: ["tag-1"],
            amount: 10000,
            where: "FPL",
            notes: "Electric",
            splitType: "split",
            settlementType: "deferred",
          },
          {
            paidBy: "john",
            tagIds: ["tag-2"],
            amount: 5000,
            where: "Water Co",
            notes: "Water",
            splitType: "split",
            settlementType: "deferred",
          },
        ],
      }),
    ]);
    asMock(Tag.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "tag-1", path: "Bills/Electric" },
        { _id: "tag-2", path: "Bills/Water" },
      ]),
    });
    // A manual FPL entry a day before the occurrence (the 10th) with a different amount.
    mockExistingExpenses([
      { where: "FPL", tags: ["tag-1"], date: utc(2026, 7, 9), amount: 99999 },
    ]);

    await runScheduler(utc(2026, 7, 15));

    const call = asMock(applyTemplateCore).mock.calls[0][0];
    expect(call.items).toHaveLength(1);
    expect(call.items[0].where).toBe("Water Co");
    expect(call.amounts).toEqual([5000]);
    expect(call.skipped).toEqual([{ where: "FPL", reason: "duplicate" }]);
  });

  it("still writes an entry and marks the occurrence done when every item is skipped", async () => {
    mockTemplates([makeAutoTemplate()]);
    mockExistingExpenses([
      { where: "FPL", tags: ["tag-1"], date: utc(2026, 7, 10), amount: 10000 },
    ]);
    asMock(applyTemplateCore).mockResolvedValue({ count: 0, expenses: [] });

    const result = await runScheduler(utc(2026, 7, 15));

    const call = asMock(applyTemplateCore).mock.calls[0][0];
    expect(call.items).toHaveLength(0);
    expect(call.skipped).toEqual([{ where: "FPL", reason: "duplicate" }]);
    // The occurrence is still claimed, completed, and counted as applied.
    expect(result.occurrencesApplied).toBe(1);
    expect(result.expensesCreated).toBe(0);
    expect(RecurringApplyLog.updateOne).toHaveBeenCalledWith(
      { templateId: "tmpl-1", occurrenceDate: utc(2026, 7, 10) },
      { $set: { status: "completed", completedAt: utc(2026, 7, 15), addedCount: 0 } }
    );
  });

  it("does not skip an item whose manual entry is outside the ±3-day window", async () => {
    mockTemplates([makeAutoTemplate()]);
    // Manual FPL entry 4 days before the occurrence — just outside the window.
    mockExistingExpenses([
      { where: "FPL", tags: ["tag-1"], date: utc(2026, 7, 6), amount: 10000 },
    ]);

    await runScheduler(utc(2026, 7, 15));

    const call = asMock(applyTemplateCore).mock.calls[0][0];
    expect(call.items).toHaveLength(1);
    expect(call.skipped).toEqual([]);
  });

  it("applies a biweekly (every_n_weeks) schedule twice in one month", async () => {
    // Anchored to Fri 2026-07-10; enabled 2026-07-01; occurrences Jul 10 and Jul 24.
    mockTemplates([
      makeAutoTemplate({
        schedule: {
          type: "every_n_weeks",
          interval: 2,
          anchorDate: "2026-07-10",
        },
      }),
    ]);

    const result = await runScheduler(utc(2026, 7, 31));

    const dates = asMock(applyTemplateCore).mock.calls.map((c) => c[0].date);
    expect(dates).toEqual([utc(2026, 7, 10), utc(2026, 7, 24)]);
    expect(result.occurrencesApplied).toBe(2);
  });

  it("applies an nth-weekday schedule after a family switch", async () => {
    // Family switched to "last Friday of the month" — July's is the 31st.
    mockTemplates([
      makeAutoTemplate({
        schedule: { type: "nth_weekday", ordinal: "last", weekday: 5 },
      }),
    ]);

    const result = await runScheduler(utc(2026, 7, 31));

    expect(applyTemplateCore).toHaveBeenCalledTimes(1);
    expect(asMock(applyTemplateCore).mock.calls[0][0].date).toEqual(
      utc(2026, 7, 31)
    );
    expect(result.occurrencesApplied).toBe(1);
  });

  it("ignores templates missing a schedule or enablement date", async () => {
    mockTemplates([
      makeAutoTemplate({ schedule: null }),
      makeAutoTemplate({ _id: "tmpl-2", autoApplyEnabledAt: null }),
    ]);

    const result = await runScheduler(utc(2026, 7, 15));

    expect(applyTemplateCore).not.toHaveBeenCalled();
    expect(result.templatesProcessed).toBe(0);
  });
});
