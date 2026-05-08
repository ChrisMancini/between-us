jest.mock("@/lib/models/activity", () => ({
  Activity: { create: jest.fn() },
}));

import { Activity } from "@/lib/models/activity";
import { logActivity } from "@/lib/activity-logger";

const mockCreate = Activity.create as jest.Mock;

describe("logActivity", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates an activity record with the correct fields", async () => {
    mockCreate.mockResolvedValue({});
    await logActivity("chris", "expense_create", "added $45.20 at Publix", {
      expenseId: "123",
      amount: 4520,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      action: "expense_create",
      actorKey: "chris",
      summary: "added $45.20 at Publix",
      metadata: { expenseId: "123", amount: 4520 },
    });
  });

  it("defaults metadata to empty object", async () => {
    mockCreate.mockResolvedValue({});
    await logActivity("lauren", "settlement_close", "closed May 2026");

    expect(mockCreate).toHaveBeenCalledWith({
      action: "settlement_close",
      actorKey: "lauren",
      summary: "closed May 2026",
      metadata: {},
    });
  });

  it("does not throw when Activity.create fails", async () => {
    mockCreate.mockRejectedValue(new Error("DB error"));
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    await expect(
      logActivity("chris", "expense_delete", "deleted $10.00 at Target")
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[logActivity] Failed to log activity:",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
