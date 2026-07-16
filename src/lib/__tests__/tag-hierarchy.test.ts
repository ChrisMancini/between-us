import { collapseToMostSpecific } from "../tag-hierarchy";

function pathMap(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe("collapseToMostSpecific", () => {
  it("returns an empty array unchanged", () => {
    expect(collapseToMostSpecific([], pathMap({}))).toEqual([]);
  });

  it("keeps a single selected tag", () => {
    const paths = pathMap({ a: "Bills" });
    expect(collapseToMostSpecific(["a"], paths)).toEqual(["a"]);
  });

  it("drops a parent when a descendant is also selected", () => {
    const paths = pathMap({ parent: "Bills", child: "Bills/Electric" });
    expect(collapseToMostSpecific(["parent", "child"], paths)).toEqual(["child"]);
  });

  it("drops a parent regardless of array order", () => {
    const paths = pathMap({ parent: "Bills", child: "Bills/Electric" });
    expect(collapseToMostSpecific(["child", "parent"], paths)).toEqual(["child"]);
  });

  it("keeps only the leaf across a three-level hierarchy", () => {
    const paths = pathMap({
      grandparent: "Vacation",
      parent: "Vacation/Italy 2026",
      child: "Vacation/Italy 2026/Hotels",
    });
    expect(
      collapseToMostSpecific(["grandparent", "parent", "child"], paths)
    ).toEqual(["child"]);
  });

  it("keeps sibling tags under the same parent", () => {
    const paths = pathMap({
      electric: "Bills/Electric",
      water: "Bills/Water",
    });
    expect(collapseToMostSpecific(["electric", "water"], paths)).toEqual([
      "electric",
      "water",
    ]);
  });

  it("keeps unrelated tags", () => {
    const paths = pathMap({ bills: "Bills", groceries: "Groceries" });
    expect(collapseToMostSpecific(["bills", "groceries"], paths)).toEqual([
      "bills",
      "groceries",
    ]);
  });

  it("does not treat a same-prefix sibling name as an ancestor", () => {
    // "Bill" is a string-prefix of "Billing/Something" but not a path ancestor.
    const paths = pathMap({ bill: "Bill", billing: "Billing/Something" });
    expect(collapseToMostSpecific(["bill", "billing"], paths)).toEqual([
      "bill",
      "billing",
    ]);
  });

  it("resolves independent conflict groups separately", () => {
    const paths = pathMap({
      bills: "Bills",
      electric: "Bills/Electric",
      groceries: "Groceries",
      store: "Groceries/Publix",
    });
    expect(
      collapseToMostSpecific(["bills", "electric", "groceries", "store"], paths)
    ).toEqual(["electric", "store"]);
  });

  it("keeps a tag id with no known path (e.g. unresolved/legacy) untouched", () => {
    const paths = pathMap({ parent: "Bills" });
    expect(collapseToMostSpecific(["parent", "unknown"], paths)).toEqual([
      "parent",
      "unknown",
    ]);
  });
});
