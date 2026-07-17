import { activityGlyphLabel } from "@/lib/activity-glyph";

describe("activityGlyphLabel", () => {
  // The template card (recurring page) and the activity feed both render the
  // auto-apply glyph and must speak the same color-blind-safe language. Pin the
  // shared labels so the two surfaces can never drift apart (issue #79).
  it("labels an automatic recurring apply", () => {
    expect(activityGlyphLabel("recurring_auto_apply")).toBe(
      "Automatic recurring apply"
    );
  });

  it("labels an auto-apply alert distinctly from a normal apply", () => {
    expect(activityGlyphLabel("recurring_auto_apply_alert")).toBe(
      "Auto-apply alert"
    );
    expect(activityGlyphLabel("recurring_auto_apply_alert")).not.toBe(
      activityGlyphLabel("recurring_auto_apply")
    );
  });

  it("returns undefined for actions whose summary text already says everything", () => {
    expect(activityGlyphLabel("expense_created")).toBeUndefined();
    expect(activityGlyphLabel("month_settled")).toBeUndefined();
  });
});
