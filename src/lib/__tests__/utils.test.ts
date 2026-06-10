import {
  formatCurrency,
  formatMonthYear,
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
  it("formats a standard month", () => {
    expect(formatMonthYear(6, 2026)).toBe("June 2026");
  });

  it("formats January", () => {
    expect(formatMonthYear(1, 2026)).toBe("January 2026");
  });

  it("formats December", () => {
    expect(formatMonthYear(12, 2025)).toBe("December 2025");
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
