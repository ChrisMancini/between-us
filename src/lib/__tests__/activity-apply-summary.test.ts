import { parseApplySummary } from "@/lib/activity-apply-summary";

describe("parseApplySummary", () => {
  it("parses a clean run with nothing skipped", () => {
    expect(
      parseApplySummary({
        templateName: "Monthly Bills",
        templateId: "t1",
        count: 3,
        skippedCount: 0,
        flaggedCount: 0,
        skipped: [],
        date: "2026-07-10",
      })
    ).toEqual({
      templateName: "Monthly Bills",
      date: "2026-07-10",
      addedCount: 3,
      duplicates: [],
      flagged: [],
    });
  });

  it("splits skipped items into duplicates and flagged by reason", () => {
    const summary = parseApplySummary({
      templateName: "Monthly Bills",
      count: 1,
      skipped: [
        { where: "FPL", reason: "duplicate" },
        { where: "Spectrum", reason: "deleted_tag" },
        { where: "Water", reason: "duplicate" },
      ],
      date: "2026-07-10",
    });
    expect(summary.duplicates).toEqual(["FPL", "Water"]);
    expect(summary.flagged).toEqual(["Spectrum"]);
    expect(summary.addedCount).toBe(1);
  });

  it("falls back to safe defaults for missing or malformed metadata", () => {
    expect(parseApplySummary({})).toEqual({
      templateName: "Template",
      date: "",
      addedCount: 0,
      duplicates: [],
      flagged: [],
    });
  });

  it("ignores non-object entries in the skipped array", () => {
    const summary = parseApplySummary({
      skipped: [null, "nope", { reason: "duplicate" }, { where: "FPL" }],
    });
    // The bare {reason:"duplicate"} contributes an empty where; {where:"FPL"}
    // has no reason and is ignored.
    expect(summary.duplicates).toEqual([""]);
    expect(summary.flagged).toEqual([]);
  });
});
