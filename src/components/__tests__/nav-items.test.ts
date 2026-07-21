import { buildNavItems } from "../nav-items";

describe("buildNavItems", () => {
  it("returns the six base items in order for a non-admin", () => {
    const items = buildNavItems(false);
    expect(items.map((i) => i.href)).toEqual([
      "/dashboard",
      "/expenses",
      "/reports",
      "/settlement",
      "/activity",
      "/recurring",
    ]);
  });

  it("appends the admin item as the last entry for an admin", () => {
    const items = buildNavItems(true);
    expect(items).toHaveLength(7);
    expect(items[items.length - 1]).toEqual({ href: "/admin", label: "Admin" });
  });

  it("does not include the admin item for a non-admin", () => {
    const items = buildNavItems(false);
    expect(items.some((i) => i.href === "/admin")).toBe(false);
  });

  it("gives every item a non-empty label", () => {
    for (const item of buildNavItems(true)) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it("does not mutate the shared base list across calls", () => {
    buildNavItems(true);
    // A second non-admin call must not have retained the admin item from the
    // previous admin call (guards against pushing onto a shared array).
    expect(buildNavItems(false).some((i) => i.href === "/admin")).toBe(false);
  });
});
