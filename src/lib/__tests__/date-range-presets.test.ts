import { getDateRangePresets } from "@/lib/date-range-presets";

describe("getDateRangePresets", () => {
  // A mid-month, mid-day anchor so start-/end-of-day snapping is observable.
  const now = new Date(2026, 6, 20, 14, 30, 0); // 2026-07-20 (local)

  function preset(label: string) {
    const p = getDateRangePresets(now).find((p) => p.label === label);
    if (!p) throw new Error(`no preset ${label}`);
    return p.range;
  }

  it("offers the four expected presets in order", () => {
    expect(getDateRangePresets(now).map((p) => p.label)).toEqual([
      "Last 7 days",
      "Last 30 days",
      "This month",
      "Last month",
    ]);
  });

  it("snaps every bound to start-/end-of-day", () => {
    for (const { range } of getDateRangePresets(now)) {
      expect(range.from!.getHours()).toBe(0);
      expect(range.from!.getMinutes()).toBe(0);
      expect(range.to!.getHours()).toBe(23);
      expect(range.to!.getMinutes()).toBe(59);
    }
  });

  it("makes 'Last 7 days' an inclusive 7-day window ending today", () => {
    const r = preset("Last 7 days");
    expect(r.from).toEqual(new Date(2026, 6, 14, 0, 0, 0));
    expect(r.to!.getDate()).toBe(20);
  });

  it("bounds 'This month' from the 1st through today", () => {
    const r = preset("This month");
    expect(r.from).toEqual(new Date(2026, 6, 1, 0, 0, 0));
    expect(r.to!.getDate()).toBe(20);
  });

  it("bounds 'Last month' to the whole previous calendar month", () => {
    const r = preset("Last month");
    expect(r.from).toEqual(new Date(2026, 5, 1, 0, 0, 0));
    expect(r.to!.getMonth()).toBe(5);
    expect(r.to!.getDate()).toBe(30); // June has 30 days
  });
});
