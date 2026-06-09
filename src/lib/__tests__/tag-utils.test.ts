import { parsePath, getAncestorPaths, ensureAncestors, serializeTag } from "../tag-utils";

jest.mock("../models/tag", () => ({
  Tag: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

import { Tag } from "../models/tag";

const mockFindOne = Tag.findOne as jest.Mock;
const mockCreate = Tag.create as jest.Mock;

describe("parsePath", () => {
  it("parses a top-level path", () => {
    expect(parsePath("Groceries")).toEqual({
      name: "Groceries",
      parent: "",
      depth: 1,
    });
  });

  it("parses a nested path", () => {
    expect(parsePath("Bills/Electric")).toEqual({
      name: "Electric",
      parent: "Bills",
      depth: 2,
    });
  });

  it("parses a deeply nested path", () => {
    expect(parsePath("Vacation/Italy 2026/Hotels")).toEqual({
      name: "Hotels",
      parent: "Vacation/Italy 2026",
      depth: 3,
    });
  });

  it("trims whitespace from segments", () => {
    expect(parsePath(" Bills / Electric ")).toEqual({
      name: "Electric",
      parent: "Bills",
      depth: 2,
    });
  });
});

describe("getAncestorPaths", () => {
  it("returns empty array for top-level path", () => {
    expect(getAncestorPaths("Groceries")).toEqual([]);
  });

  it("returns parent for a two-level path", () => {
    expect(getAncestorPaths("Bills/Electric")).toEqual(["Bills"]);
  });

  it("returns all ancestors for a deeply nested path", () => {
    expect(getAncestorPaths("Vacation/Italy 2026/Hotels")).toEqual([
      "Vacation",
      "Vacation/Italy 2026",
    ]);
  });

  it("trims whitespace from segments", () => {
    expect(getAncestorPaths(" Bills / Electric ")).toEqual(["Bills"]);
  });
});

describe("ensureAncestors", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does nothing for a top-level path", async () => {
    await ensureAncestors("Groceries");
    expect(mockFindOne).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates missing ancestor tags", async () => {
    mockFindOne
      .mockReturnValueOnce({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ sortOrder: 5 }) }) })
      .mockReturnValueOnce({ collation: jest.fn().mockResolvedValue(null) });
    mockCreate.mockResolvedValue({});

    await ensureAncestors("Bills/Electric");

    expect(mockCreate).toHaveBeenCalledWith({ path: "Bills", sortOrder: 6 });
  });

  it("skips existing ancestor tags", async () => {
    mockFindOne
      .mockReturnValueOnce({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ sortOrder: 3 }) }) })
      .mockReturnValueOnce({ collation: jest.fn().mockResolvedValue({ path: "Bills" }) });

    await ensureAncestors("Bills/Electric");

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("starts sortOrder at 1 when no tags exist", async () => {
    mockFindOne
      .mockReturnValueOnce({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) })
      .mockReturnValueOnce({ collation: jest.fn().mockResolvedValue(null) });
    mockCreate.mockResolvedValue({});

    await ensureAncestors("Bills/Electric");

    expect(mockCreate).toHaveBeenCalledWith({ path: "Bills", sortOrder: 1 });
  });

  it("creates multiple ancestors with incrementing sortOrder", async () => {
    mockFindOne
      .mockReturnValueOnce({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ sortOrder: 10 }) }) })
      .mockReturnValueOnce({ collation: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ collation: jest.fn().mockResolvedValue(null) });
    mockCreate.mockResolvedValue({});

    await ensureAncestors("Vacation/Italy 2026/Hotels");

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenNthCalledWith(1, { path: "Vacation", sortOrder: 11 });
    expect(mockCreate).toHaveBeenNthCalledWith(2, { path: "Vacation/Italy 2026", sortOrder: 12 });
  });
});

describe("serializeTag", () => {
  it("serializes a top-level tag", () => {
    const doc = { _id: "abc123", path: "Groceries", sortOrder: 1 };
    expect(serializeTag(doc)).toEqual({
      _id: "abc123",
      path: "Groceries",
      sortOrder: 1,
      name: "Groceries",
      parent: "",
      depth: 1,
    });
  });

  it("serializes a nested tag", () => {
    const doc = { _id: "def456", path: "Bills/Electric", sortOrder: 3 };
    expect(serializeTag(doc)).toEqual({
      _id: "def456",
      path: "Bills/Electric",
      sortOrder: 3,
      name: "Electric",
      parent: "Bills",
      depth: 2,
    });
  });

  it("stringifies ObjectId-like _id", () => {
    const doc = { _id: { toString: () => "obj789" }, path: "Food", sortOrder: 2 };
    expect(serializeTag(doc)._id).toBe("obj789");
  });
});
