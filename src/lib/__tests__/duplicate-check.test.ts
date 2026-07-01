import { buildDuplicateMap, checkDuplicateExpenses } from "@/lib/duplicate-check";

describe("buildDuplicateMap", () => {
  it("returns an empty map for empty input", () => {
    expect(buildDuplicateMap([])).toEqual(new Map());
  });

  it("maps a single expense by date|amount", () => {
    const result = buildDuplicateMap([
      { date: "2026-06-15T00:00:00.000Z", amount: 4250, where: "Publix" },
    ]);
    expect(result.get("2026-06-15|4250")).toBe("Publix");
    expect(result.size).toBe(1);
  });

  it("maps multiple expenses with different keys", () => {
    const result = buildDuplicateMap([
      { date: "2026-06-15T00:00:00.000Z", amount: 4250, where: "Publix" },
      { date: "2026-06-16T00:00:00.000Z", amount: 1000, where: "Amazon" },
    ]);
    expect(result.get("2026-06-15|4250")).toBe("Publix");
    expect(result.get("2026-06-16|1000")).toBe("Amazon");
    expect(result.size).toBe(2);
  });

  it("last entry wins when duplicate keys exist", () => {
    const result = buildDuplicateMap([
      { date: "2026-06-15T00:00:00.000Z", amount: 4250, where: "Publix" },
      { date: "2026-06-15T00:00:00.000Z", amount: 4250, where: "Kroger" },
    ]);
    expect(result.get("2026-06-15|4250")).toBe("Kroger");
    expect(result.size).toBe(1);
  });
});

describe("checkDuplicateExpenses", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns matching expenses when API returns matches", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          expenses: [
            { date: "2026-06-15T00:00:00.000Z", amount: 4250, where: "Publix" },
          ],
        }),
    });

    const result = await checkDuplicateExpenses("2026-06-15", 4250);
    expect(result).toEqual([
      { date: "2026-06-15T00:00:00.000Z", amount: 4250, where: "Publix" },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/expenses/check-duplicates?startDate=2026-06-15&endDate=2026-06-15"
    );
  });

  it("filters out expenses with different amounts", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          expenses: [
            { date: "2026-06-15T00:00:00.000Z", amount: 4250, where: "Publix" },
            { date: "2026-06-15T00:00:00.000Z", amount: 9999, where: "Target" },
          ],
        }),
    });

    const result = await checkDuplicateExpenses("2026-06-15", 4250);
    expect(result).toEqual([
      { date: "2026-06-15T00:00:00.000Z", amount: 4250, where: "Publix" },
    ]);
  });

  it("returns empty array when fetch throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const result = await checkDuplicateExpenses("2026-06-15", 4250);
    expect(result).toEqual([]);
  });

  it("returns empty array when response is not ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    });

    const result = await checkDuplicateExpenses("2026-06-15", 4250);
    expect(result).toEqual([]);
  });
});
