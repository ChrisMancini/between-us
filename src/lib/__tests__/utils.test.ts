import {
  formatCurrency,
  formatMonthYear,
  formatShortDate,
  parseMonthYearParams,
  getMonthDateRange,
  formatActivityDate,
} from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats zero cents", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats a standard amount", () => {
    expect(formatCurrency(4250)).toBe("$42.50");
  });

  it("formats a large amount with comma separator", () => {
    expect(formatCurrency(123456)).toBe("$1,234.56");
  });

  it("formats odd cent amounts", () => {
    expect(formatCurrency(1)).toBe("$0.01");
    expect(formatCurrency(99)).toBe("$0.99");
  });
});

describe("formatMonthYear", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 5, 15)));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("omits year for current-year months by default", () => {
    expect(formatMonthYear(6, 2026)).toBe("June");
  });

  it("includes year for past-year months by default", () => {
    expect(formatMonthYear(12, 2025)).toBe("December 2025");
  });

  it("includes year when omitCurrentYear is false", () => {
    expect(formatMonthYear(5, 2026, { omitCurrentYear: false })).toBe("May 2026");
  });

  it("omits year when omitCurrentYear is true", () => {
    expect(formatMonthYear(5, 2026, { omitCurrentYear: true })).toBe("May");
  });

  it("includes year for past-year months even with omitCurrentYear true", () => {
    expect(formatMonthYear(12, 2025, { omitCurrentYear: true })).toBe("December 2025");
  });
});

describe("formatShortDate", () => {
  describe("omitCurrentYear", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(Date.UTC(2026, 5, 15)));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("omits year for a current-year date", () => {
      expect(formatShortDate("2026-06-05T00:00:00.000Z", { omitCurrentYear: true })).toBe("Jun 5");
    });

    it("includes year for a past-year date", () => {
      expect(formatShortDate("2025-06-05T00:00:00.000Z", { omitCurrentYear: true })).toBe("Jun 5, 2025");
    });
  });

  it("formats a date with year by default", () => {
    expect(formatShortDate("2025-06-05T00:00:00.000Z")).toBe("Jun 5, 2025");
  });

  it("accepts a Date object", () => {
    expect(formatShortDate(new Date(Date.UTC(2025, 5, 5)))).toBe("Jun 5, 2025");
  });
});

describe("parseMonthYearParams", () => {
  it("parses valid month and year strings", () => {
    expect(parseMonthYearParams({ month: "3", year: "2025" })).toEqual({
      month: 3,
      year: 2025,
    });
  });

  it("defaults to current month/year when params are missing", () => {
    const now = new Date();
    const result = parseMonthYearParams({});
    expect(result.month).toBe(now.getMonth() + 1);
    expect(result.year).toBe(now.getFullYear());
  });

  it("defaults to current month/year for non-numeric strings", () => {
    const now = new Date();
    const result = parseMonthYearParams({ month: "abc", year: "xyz" });
    expect(result.month).toBe(now.getMonth() + 1);
    expect(result.year).toBe(now.getFullYear());
  });

  it("handles only month provided", () => {
    const now = new Date();
    const result = parseMonthYearParams({ month: "7" });
    expect(result.month).toBe(7);
    expect(result.year).toBe(now.getFullYear());
  });

  it("handles only year provided", () => {
    const now = new Date();
    const result = parseMonthYearParams({ year: "2024" });
    expect(result.month).toBe(now.getMonth() + 1);
    expect(result.year).toBe(2024);
  });
});

describe("formatActivityDate", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns a relative timeAgo string", () => {
    const { timeAgo } = formatActivityDate(new Date("2026-06-10T10:00:00.000Z"));
    expect(timeAgo).toBe("about 2 hours ago");
  });

  it("accepts a date string", () => {
    const { timeAgo } = formatActivityDate("2026-06-10T10:00:00.000Z");
    expect(timeAgo).toBe("about 2 hours ago");
  });

  it("excludes year from fullDate by default", () => {
    const { fullDate } = formatActivityDate(new Date("2026-06-10T14:30:00.000Z"));
    expect(fullDate).not.toMatch(/2026/);
  });

  it("includes year in fullDate when includeYear is true", () => {
    const { fullDate } = formatActivityDate(new Date("2026-06-10T14:30:00.000Z"), true);
    expect(fullDate).toMatch(/2026/);
  });
});

describe("getMonthDateRange", () => {
  it("returns correct UTC boundaries for a standard month", () => {
    const { start, end } = getMonthDateRange(6, 2026);
    expect(start).toEqual(new Date(Date.UTC(2026, 5, 1)));
    expect(end).toEqual(new Date(Date.UTC(2026, 6, 1)));
  });

  it("handles January correctly", () => {
    const { start, end } = getMonthDateRange(1, 2026);
    expect(start).toEqual(new Date(Date.UTC(2026, 0, 1)));
    expect(end).toEqual(new Date(Date.UTC(2026, 1, 1)));
  });

  it("handles December with year rollover", () => {
    const { start, end } = getMonthDateRange(12, 2025);
    expect(start).toEqual(new Date(Date.UTC(2025, 11, 1)));
    expect(end).toEqual(new Date(Date.UTC(2026, 0, 1)));
  });
});
