import {
  generateMonthEntries,
  buildTrendSeries,
} from "../report-transforms";

describe("generateMonthEntries", () => {
  it("generates 6 months from mid-year", () => {
    const entries = generateMonthEntries(2026, 1, 6);
    expect(entries).toEqual([
      { month: 1, year: 2026 },
      { month: 2, year: 2026 },
      { month: 3, year: 2026 },
      { month: 4, year: 2026 },
      { month: 5, year: 2026 },
      { month: 6, year: 2026 },
    ]);
  });

  it("wraps across year boundary when startMonth is negative", () => {
    // 6 months back from January 2026 → starts Aug 2025
    const entries = generateMonthEntries(2026, -4, 6);
    expect(entries).toEqual([
      { month: 8, year: 2025 },
      { month: 9, year: 2025 },
      { month: 10, year: 2025 },
      { month: 11, year: 2025 },
      { month: 12, year: 2025 },
      { month: 1, year: 2026 },
    ]);
  });

  it("generates all 12 months for a full year", () => {
    const entries = generateMonthEntries(2026, 1, 12);
    expect(entries).toHaveLength(12);
    expect(entries[0]).toEqual({ month: 1, year: 2026 });
    expect(entries[11]).toEqual({ month: 12, year: 2026 });
  });

  it("generates a single month", () => {
    const entries = generateMonthEntries(2026, 6, 1);
    expect(entries).toEqual([{ month: 6, year: 2026 }]);
  });

  it("wraps forward across year boundary", () => {
    const entries = generateMonthEntries(2025, 10, 6);
    expect(entries).toEqual([
      { month: 10, year: 2025 },
      { month: 11, year: 2025 },
      { month: 12, year: 2025 },
      { month: 1, year: 2026 },
      { month: 2, year: 2026 },
      { month: 3, year: 2026 },
    ]);
  });
});

describe("buildTrendSeries", () => {
  const twoMonths = [
    { month: 1, year: 2026 },
    { month: 2, year: 2026 },
  ];

  it("returns all zeros for empty aggregation data", () => {
    const result = buildTrendSeries([], twoMonths);
    expect(result).toEqual([
      { month: 1, year: 2026, deferredTotal: 0, immediateTotal: 0, total: 0 },
      { month: 2, year: 2026, deferredTotal: 0, immediateTotal: 0, total: 0 },
    ]);
  });

  it("fills a deferred entry into the correct month", () => {
    const agg = [
      { _id: { year: 2026, month: 1, settlementType: "deferred" }, total: 5000 },
    ];
    const result = buildTrendSeries(agg, twoMonths);
    expect(result[0].deferredTotal).toBe(5000);
    expect(result[0].immediateTotal).toBe(0);
    expect(result[0].total).toBe(5000);
    expect(result[1].total).toBe(0);
  });

  it("fills an immediate entry into the correct month", () => {
    const agg = [
      { _id: { year: 2026, month: 2, settlementType: "immediate" }, total: 3000 },
    ];
    const result = buildTrendSeries(agg, twoMonths);
    expect(result[1].immediateTotal).toBe(3000);
    expect(result[1].deferredTotal).toBe(0);
    expect(result[1].total).toBe(3000);
  });

  it("accumulates deferred and immediate in the same month", () => {
    const agg = [
      { _id: { year: 2026, month: 1, settlementType: "deferred" }, total: 2000 },
      { _id: { year: 2026, month: 1, settlementType: "immediate" }, total: 1000 },
    ];
    const result = buildTrendSeries(agg, twoMonths);
    expect(result[0].deferredTotal).toBe(2000);
    expect(result[0].immediateTotal).toBe(1000);
    expect(result[0].total).toBe(3000);
  });

  it("ignores aggregation rows for months not in the series", () => {
    const agg = [
      { _id: { year: 2025, month: 12, settlementType: "deferred" }, total: 9999 },
    ];
    const result = buildTrendSeries(agg, twoMonths);
    expect(result[0].total).toBe(0);
    expect(result[1].total).toBe(0);
  });

  it("preserves month order from input", () => {
    const months = [
      { month: 11, year: 2025 },
      { month: 12, year: 2025 },
      { month: 1, year: 2026 },
    ];
    const agg = [
      { _id: { year: 2026, month: 1, settlementType: "deferred" }, total: 100 },
      { _id: { year: 2025, month: 11, settlementType: "deferred" }, total: 200 },
    ];
    const result = buildTrendSeries(agg, months);
    expect(result[0]).toMatchObject({ month: 11, year: 2025, total: 200 });
    expect(result[1]).toMatchObject({ month: 12, year: 2025, total: 0 });
    expect(result[2]).toMatchObject({ month: 1, year: 2026, total: 100 });
  });
});
