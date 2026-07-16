import { normalizeTemplateItemTagIds } from "../recurring-template-utils";

describe("normalizeTemplateItemTagIds", () => {
  it("collapses each item's tagIds independently", () => {
    const pathById = new Map([
      ["bills", "Bills"],
      ["electric", "Bills/Electric"],
      ["groceries", "Groceries"],
    ]);

    const items = [
      { name: "Electric", tagIds: ["bills", "electric"] },
      { name: "Groceries", tagIds: ["groceries"] },
    ];

    const result = normalizeTemplateItemTagIds(items, pathById);

    expect(result).toEqual([
      { name: "Electric", tagIds: ["electric"] },
      { name: "Groceries", tagIds: ["groceries"] },
    ]);
  });

  it("does not collapse tags across separate items", () => {
    const pathById = new Map([
      ["bills", "Bills"],
      ["electric", "Bills/Electric"],
    ]);

    const items = [
      { tagIds: ["bills"] },
      { tagIds: ["electric"] },
    ];

    const result = normalizeTemplateItemTagIds(items, pathById);

    expect(result).toEqual([{ tagIds: ["bills"] }, { tagIds: ["electric"] }]);
  });
});
