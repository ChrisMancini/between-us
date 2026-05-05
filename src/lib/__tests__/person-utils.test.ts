import { buildPersonMap, badgeProps } from "@/lib/person-utils";
import type { PersonPair } from "@/types/person";

const persons: PersonPair = [
  { _id: "id1", key: "john", displayName: "John", role: "admin", colorIndex: 0 },
  { _id: "id2", key: "jane", displayName: "Jane", role: "user", colorIndex: 1 },
];

describe("buildPersonMap", () => {
  it("creates a map with both persons keyed by their key", () => {
    const map = buildPersonMap(persons);
    expect(map.size).toBe(2);
    expect(map.get("john")).toEqual(persons[0]);
    expect(map.get("jane")).toEqual(persons[1]);
  });

  it("returns undefined for unknown key", () => {
    const map = buildPersonMap(persons);
    expect(map.get("unknown")).toBeUndefined();
  });
});

describe("badgeProps", () => {
  const map = buildPersonMap(persons);

  it("returns display name and colorIndex for known person", () => {
    expect(badgeProps("john", map)).toEqual({
      personKey: "john",
      displayName: "John",
      colorIndex: 0,
    });
  });

  it("returns correct colorIndex for second person", () => {
    expect(badgeProps("jane", map)).toEqual({
      personKey: "jane",
      displayName: "Jane",
      colorIndex: 1,
    });
  });

  it("falls back to key as display name and colorIndex 0 for unknown person", () => {
    expect(badgeProps("unknown", map)).toEqual({
      personKey: "unknown",
      displayName: "unknown",
      colorIndex: 0,
    });
  });
});
