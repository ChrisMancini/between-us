import {
  DUPLICATE_SKIP_WINDOW_DAYS,
  isDuplicateOfExisting,
  type DuplicateSkipExpense,
} from "@/lib/recurring-duplicate-skip";

const utc = (y: number, m: number, d: number, h = 0) =>
  new Date(Date.UTC(y, m - 1, d, h));

const OCCURRENCE = utc(2026, 7, 10);

function expense(
  overrides: Partial<DuplicateSkipExpense> = {}
): DuplicateSkipExpense {
  return {
    where: "FPL",
    tags: ["tag-1"],
    date: OCCURRENCE,
    ...overrides,
  };
}

describe("isDuplicateOfExisting", () => {
  const item = { where: "FPL", tagIds: ["tag-1"] };

  it("is false when there are no existing expenses", () => {
    expect(isDuplicateOfExisting(item, OCCURRENCE, [])).toBe(false);
  });

  it("skips a same where + tag expense on the occurrence date", () => {
    expect(isDuplicateOfExisting(item, OCCURRENCE, [expense()])).toBe(true);
  });

  it("ignores amount entirely (predicate never sees it)", () => {
    // A hand-corrected amount is still the same expense — where + tag + date match.
    expect(isDuplicateOfExisting(item, OCCURRENCE, [expense()])).toBe(true);
  });

  it("matches despite small date drift within the window", () => {
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ date: utc(2026, 7, 8) })])
    ).toBe(true);
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ date: utc(2026, 7, 12) })])
    ).toBe(true);
  });

  it("matches at exactly the window boundary (±3 days)", () => {
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ date: utc(2026, 7, 7) })])
    ).toBe(true);
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ date: utc(2026, 7, 13) })])
    ).toBe(true);
  });

  it("does not match just outside the window", () => {
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ date: utc(2026, 7, 6) })])
    ).toBe(false);
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ date: utc(2026, 7, 14) })])
    ).toBe(false);
  });

  it("compares whole calendar days, not exact times", () => {
    // 3 days minus a few hours is still 3 calendar days away — a match.
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ date: utc(2026, 7, 13, 23) })])
    ).toBe(true);
  });

  it("does not match a different where", () => {
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ where: "Duke Energy" })])
    ).toBe(false);
  });

  it("matches where case-insensitively and trims whitespace", () => {
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ where: "  fpl  " })])
    ).toBe(true);
  });

  it("does not match when no tag overlaps", () => {
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ tags: ["tag-9"] })])
    ).toBe(false);
  });

  it("matches when at least one tag overlaps", () => {
    expect(
      isDuplicateOfExisting(
        { where: "FPL", tagIds: ["tag-1", "tag-2"] },
        OCCURRENCE,
        [expense({ tags: ["tag-2", "tag-3"] })]
      )
    ).toBe(true);
  });

  it("requires where AND tag AND window together", () => {
    // Right window + tag but wrong where.
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ where: "Other" })])
    ).toBe(false);
    // Right where + tag but outside window.
    expect(
      isDuplicateOfExisting(item, OCCURRENCE, [expense({ date: utc(2026, 8, 10) })])
    ).toBe(false);
  });

  it("does not let a biweekly template's two occurrences skip each other", () => {
    // An expense created for the first occurrence (the 10th) must not cause the
    // second occurrence (14 days later) to skip itself: 14 > 2 * window.
    const firstOccurrence = utc(2026, 7, 10);
    const secondOccurrence = utc(2026, 7, 24);
    const createdAtFirst = expense({ date: firstOccurrence });

    expect(isDuplicateOfExisting(item, firstOccurrence, [createdAtFirst])).toBe(
      true
    );
    expect(isDuplicateOfExisting(item, secondOccurrence, [createdAtFirst])).toBe(
      false
    );
  });

  it("exposes the window width as a narrower-than-weekly constant", () => {
    expect(DUPLICATE_SKIP_WINDOW_DAYS).toBeLessThan(7);
  });
});
