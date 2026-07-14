import {
  glyph,
  deltaAmount,
  deltaPct,
  statusLabel,
  directionClass,
  bookends,
} from "../delta-format";

describe("glyph", () => {
  it("uses distinct glyphs per status", () => {
    expect(glyph("up")).toBe("▲");
    expect(glyph("down")).toBe("▼");
    expect(glyph("steady")).toBe("＝");
    expect(glyph("new")).toBe("＋");
    expect(glyph("gone")).toBe("－");
  });
});

describe("deltaAmount", () => {
  it("prefixes a plus sign for an increase", () => {
    expect(deltaAmount(12000)).toBe("+$120.00");
  });

  it("prefixes a U+2212 minus sign for a decrease", () => {
    expect(deltaAmount(-10000)).toBe("−$100.00");
  });

  it("shows no sign for zero", () => {
    expect(deltaAmount(0)).toBe("$0.00");
  });
});

describe("deltaPct", () => {
  it("returns null when suppressed", () => {
    expect(deltaPct(null)).toBeNull();
  });

  it("formats a positive percentage with a plus and no decimals", () => {
    expect(deltaPct(38.4)).toBe("+38%");
  });

  it("formats a negative percentage with a U+2212 minus", () => {
    expect(deltaPct(-40)).toBe("−40%");
  });

  it("shows no sign for zero percent", () => {
    expect(deltaPct(0)).toBe("0%");
  });
});

describe("statusLabel", () => {
  it("labels new and gone but nothing else", () => {
    expect(statusLabel("new")).toBe("new");
    expect(statusLabel("gone")).toBe("gone");
    expect(statusLabel("up")).toBeNull();
    expect(statusLabel("down")).toBeNull();
    expect(statusLabel("steady")).toBeNull();
  });
});

describe("bookends", () => {
  it("formats both sides as currency for an up/down/steady pair", () => {
    expect(bookends({ fromTotal: 10000, toTotal: 15000, status: "up" })).toEqual({
      from: "$100.00",
      to: "$150.00",
    });
  });

  it("renders the absent from side as an em-dash for a new tag", () => {
    expect(bookends({ fromTotal: 0, toTotal: 45000, status: "new" })).toEqual({
      from: "—",
      to: "$450.00",
    });
  });

  it("renders the absent to side as an em-dash for a gone tag", () => {
    expect(bookends({ fromTotal: 30000, toTotal: 0, status: "gone" })).toEqual({
      from: "$300.00",
      to: "—",
    });
  });

  it("shows a real $0.00 (not an em-dash) when a present side is genuinely zero", () => {
    // A steady $0 → $0 is not new/gone, so both sides are formatted, never dashed.
    expect(bookends({ fromTotal: 0, toTotal: 0, status: "steady" })).toEqual({
      from: "$0.00",
      to: "$0.00",
    });
  });
});

describe("directionClass", () => {
  it("maps increases (up/new) to sky", () => {
    expect(directionClass("up")).toContain("sky");
    expect(directionClass("new")).toContain("sky");
  });

  it("maps decreases (down/gone) to slate", () => {
    expect(directionClass("down")).toContain("slate");
    expect(directionClass("gone")).toContain("slate");
  });

  it("maps steady to muted, never red or green", () => {
    const steady = directionClass("steady");
    expect(steady).toBe("text-muted-foreground");
    for (const status of ["up", "down", "steady", "new", "gone"] as const) {
      expect(directionClass(status)).not.toMatch(/red|green/);
    }
  });
});
