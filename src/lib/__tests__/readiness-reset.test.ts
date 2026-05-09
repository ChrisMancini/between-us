jest.mock("@/lib/models/month-readiness", () => ({
  MonthReadiness: { updateMany: jest.fn() },
}));

import { MonthReadiness } from "@/lib/models/month-readiness";
import { resetReadinessForMonths } from "../readiness-reset";

const mockUpdateMany = MonthReadiness.updateMany as jest.Mock;

describe("resetReadinessForMonths", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does nothing when dates array is empty", async () => {
    await resetReadinessForMonths("john", []);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("calls updateMany with a single month/year pair", async () => {
    mockUpdateMany.mockResolvedValue({});
    await resetReadinessForMonths("john", ["2026-04-15"]);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      { $or: [{ month: 4, year: 2026 }], doneBy: "john" },
      { $pull: { doneBy: "john" } }
    );
  });

  it("deduplicates dates in the same month", async () => {
    mockUpdateMany.mockResolvedValue({});
    await resetReadinessForMonths("john", [
      "2026-04-01",
      "2026-04-15",
      "2026-04-30",
    ]);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      { $or: [{ month: 4, year: 2026 }], doneBy: "john" },
      { $pull: { doneBy: "john" } }
    );
  });

  it("handles multiple distinct months", async () => {
    mockUpdateMany.mockResolvedValue({});
    await resetReadinessForMonths("jane", ["2026-04-15", "2026-05-10"]);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      {
        $or: [
          { month: 4, year: 2026 },
          { month: 5, year: 2026 },
        ],
        doneBy: "jane",
      },
      { $pull: { doneBy: "jane" } }
    );
  });

  it("handles Date objects as well as strings", async () => {
    mockUpdateMany.mockResolvedValue({});
    await resetReadinessForMonths("john", [
      new Date(Date.UTC(2026, 3, 15)),
    ]);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      { $or: [{ month: 4, year: 2026 }], doneBy: "john" },
      { $pull: { doneBy: "john" } }
    );
  });

  it("catches errors and does not throw", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    mockUpdateMany.mockRejectedValue(new Error("DB down"));

    await expect(
      resetReadinessForMonths("john", ["2026-04-15"])
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[resetReadinessForMonths] Failed:",
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
