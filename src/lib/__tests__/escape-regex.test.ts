import { escapeRegex } from "../escape-regex";

describe("escapeRegex", () => {
  it("returns plain strings unchanged", () => {
    expect(escapeRegex("hello")).toBe("hello");
  });

  it("escapes all regex metacharacters", () => {
    expect(escapeRegex("a.b")).toBe("a\\.b");
    expect(escapeRegex("a*b")).toBe("a\\*b");
    expect(escapeRegex("a+b")).toBe("a\\+b");
    expect(escapeRegex("a?b")).toBe("a\\?b");
    expect(escapeRegex("a(b)")).toBe("a\\(b\\)");
    expect(escapeRegex("a[b]")).toBe("a\\[b\\]");
    expect(escapeRegex("a{b}")).toBe("a\\{b\\}");
    expect(escapeRegex("a|b")).toBe("a\\|b");
    expect(escapeRegex("a^b")).toBe("a\\^b");
    expect(escapeRegex("a$b")).toBe("a\\$b");
    expect(escapeRegex("a\\b")).toBe("a\\\\b");
  });

  it("escapes multiple metacharacters in the same string", () => {
    expect(escapeRegex("FPL. (electric)")).toBe("FPL\\. \\(electric\\)");
  });

  it("handles empty string", () => {
    expect(escapeRegex("")).toBe("");
  });
});
