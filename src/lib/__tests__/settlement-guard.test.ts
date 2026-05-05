jest.mock("@/lib/models/settlement", () => ({
  Settlement: {
    find: jest.fn(),
  },
}));

import { Settlement } from "@/lib/models/settlement";
import { assertMonthsOpen } from "@/lib/settlement-guard";

const mockFind = Settlement.find as jest.Mock;

function mockClosedSettlements(settlements: { month: number; year: number }[]) {
  mockFind.mockReturnValue({
    lean: jest.fn().mockResolvedValue(settlements),
  });
}

describe("assertMonthsOpen", () => {
  beforeEach(() => {
    mockFind.mockReset();
  });

  it("returns null when all months are open", async () => {
    mockClosedSettlements([]);
    const result = await assertMonthsOpen(["2025-01-15"]);
    expect(result).toBeNull();
  });

  it("returns 422 with singular message for one closed month", async () => {
    mockClosedSettlements([{ month: 1, year: 2025 }]);
    const result = await assertMonthsOpen(["2025-01-15"]);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(422);
    const body = await result!.json();
    expect(body.error).toBe("January 2025 has already been settled. Reopen the month first.");
  });

  it("returns 422 with plural message for multiple closed months", async () => {
    mockClosedSettlements([
      { month: 1, year: 2025 },
      { month: 2, year: 2025 },
    ]);
    const result = await assertMonthsOpen(["2025-01-15", "2025-02-10"]);
    expect(result).not.toBeNull();
    const body = await result!.json();
    expect(body.error).toContain("settled months");
    expect(body.error).toContain("January 2025");
    expect(body.error).toContain("February 2025");
  });

  it("accepts Date objects", async () => {
    mockClosedSettlements([{ month: 3, year: 2025 }]);
    const result = await assertMonthsOpen([new Date(Date.UTC(2025, 2, 15))]);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(422);
  });

  it("deduplicates months from multiple dates in the same month", async () => {
    mockClosedSettlements([]);
    await assertMonthsOpen(["2025-01-05", "2025-01-20", "2025-01-31"]);
    const queryArg = mockFind.mock.calls[0][0];
    expect(queryArg.$or).toHaveLength(1);
    expect(queryArg.$or[0]).toMatchObject({ month: 1, year: 2025 });
  });
});
