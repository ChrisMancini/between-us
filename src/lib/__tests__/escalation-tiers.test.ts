import {
  getEscalationTier,
  getHighestEscalationTier,
} from "../escalation-tiers";

describe("getEscalationTier", () => {
  it("returns null when less than 7 days past month end", () => {
    // May 2026 ends June 1. 6 days later = June 7.
    const now = new Date(Date.UTC(2026, 5, 7, 0, 0, 0));
    expect(getEscalationTier({ month: 5, year: 2026 }, now)).toBeNull();
  });

  it("returns null on the exact day month ends", () => {
    const now = new Date(Date.UTC(2026, 5, 1, 0, 0, 0));
    expect(getEscalationTier({ month: 5, year: 2026 }, now)).toBeNull();
  });

  it("returns warning at exactly 7 days past month end", () => {
    // May ends June 1. 7 days later = June 8.
    const now = new Date(Date.UTC(2026, 5, 8, 0, 0, 0));
    expect(getEscalationTier({ month: 5, year: 2026 }, now)).toBe("warning");
  });

  it("returns warning between 7 days and 1 month past", () => {
    const now = new Date(Date.UTC(2026, 5, 20, 0, 0, 0));
    expect(getEscalationTier({ month: 5, year: 2026 }, now)).toBe("warning");
  });

  it("returns overdue at exactly 1 calendar month past month end", () => {
    // May ends June 1. 1 month later = July 1.
    const now = new Date(Date.UTC(2026, 6, 1, 0, 0, 0));
    expect(getEscalationTier({ month: 5, year: 2026 }, now)).toBe("overdue");
  });

  it("returns overdue between 1 and 2 months past", () => {
    const now = new Date(Date.UTC(2026, 6, 15, 0, 0, 0));
    expect(getEscalationTier({ month: 5, year: 2026 }, now)).toBe("overdue");
  });

  it("returns critical at exactly 2 calendar months past month end", () => {
    // May ends June 1. 2 months later = August 1.
    const now = new Date(Date.UTC(2026, 7, 1, 0, 0, 0));
    expect(getEscalationTier({ month: 5, year: 2026 }, now)).toBe("critical");
  });

  it("returns critical more than 2 months past", () => {
    const now = new Date(Date.UTC(2026, 9, 15, 0, 0, 0));
    expect(getEscalationTier({ month: 5, year: 2026 }, now)).toBe("critical");
  });

  it("handles year rollover — December evaluated in February", () => {
    // December 2025 ends January 1, 2026. Evaluated Feb 15.
    const now = new Date(Date.UTC(2026, 1, 15, 0, 0, 0));
    expect(getEscalationTier({ month: 12, year: 2025 }, now)).toBe("overdue");
  });

  it("handles year rollover — December critical in March", () => {
    const now = new Date(Date.UTC(2026, 2, 1, 0, 0, 0));
    expect(getEscalationTier({ month: 12, year: 2025 }, now)).toBe("critical");
  });

  it("returns null for current or future month", () => {
    const now = new Date(Date.UTC(2026, 5, 15, 0, 0, 0));
    expect(getEscalationTier({ month: 6, year: 2026 }, now)).toBeNull();
  });
});

describe("getHighestEscalationTier", () => {
  it("returns null for empty array", () => {
    expect(getHighestEscalationTier([])).toBeNull();
  });

  it("returns null when no months have crossed the threshold", () => {
    const now = new Date(Date.UTC(2026, 5, 5, 0, 0, 0));
    expect(
      getHighestEscalationTier([{ month: 5, year: 2026 }], now)
    ).toBeNull();
  });

  it("returns the most severe tier among multiple months", () => {
    const now = new Date(Date.UTC(2026, 7, 15, 0, 0, 0));
    const months = [
      { month: 7, year: 2026 }, // warning (7+ days past)
      { month: 6, year: 2026 }, // overdue (1+ month past)
      { month: 5, year: 2026 }, // critical (2+ months past)
    ];
    expect(getHighestEscalationTier(months, now)).toBe("critical");
  });

  it("returns warning when all months are in warning tier", () => {
    const now = new Date(Date.UTC(2026, 5, 15, 0, 0, 0));
    const months = [{ month: 5, year: 2026 }];
    expect(getHighestEscalationTier(months, now)).toBe("warning");
  });

  it("ignores months that have not crossed the threshold", () => {
    const now = new Date(Date.UTC(2026, 5, 15, 0, 0, 0));
    const months = [
      { month: 5, year: 2026 }, // warning
      { month: 6, year: 2026 }, // null (current month)
    ];
    expect(getHighestEscalationTier(months, now)).toBe("warning");
  });
});

