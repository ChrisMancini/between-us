import {
  makeSession,
  asMock,
  makeParsedSuccess,
  makeParsedFailure,
  makeJsonRequest,
  VALID_ID,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/tag", () => ({
  Tag: { findOne: jest.fn(), create: jest.fn() },
}));
jest.mock("@/lib/utils", () => ({ isDuplicateKeyError: jest.fn() }));
jest.mock("@/lib/validations/tag", () => ({
  tagApiSchema: { safeParse: jest.fn() },
}));
jest.mock("@/lib/tag-utils", () => ({
  serializeTag: jest.fn((t: { _id: unknown; path: string; sortOrder: number }) => ({
    _id: String(t._id),
    path: t.path,
    sortOrder: t.sortOrder,
    name: t.path,
    parent: "",
    depth: 1,
  })),
  ensureAncestors: jest.fn(),
}));

import { auth } from "@/auth";
import { Tag } from "@/lib/models/tag";
import { tagApiSchema } from "@/lib/validations/tag";
import { isDuplicateKeyError } from "@/lib/utils";
import { POST } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(tagApiSchema.safeParse);

describe("POST /api/tags/create-inline", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/tags/create-inline", {}));
    await expectStatus(res, 401);
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await POST(makeJsonRequest("/api/tags/create-inline", {}));
    await expectError(res, 400, "Validation failed");
  });

  it("returns 200 when tag already exists", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ path: "Groceries" }));
    const existing = { _id: VALID_ID, path: "Groceries", sortOrder: 1 };
    asMock(Tag.findOne).mockReturnValue({
      collation: jest.fn().mockResolvedValue(existing),
    });

    const res = await POST(makeJsonRequest("/api/tags/create-inline", {}));
    const body = await expectStatus(res, 200);
    expect(body.tag.path).toBe("Groceries");
  });

  it("returns 201 on success when tag is new", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ path: "Groceries" }));
    // First findOne (collation check) returns null
    asMock(Tag.findOne).mockReturnValueOnce({
      collation: jest.fn().mockResolvedValue(null),
    });
    // Second findOne (sortOrder lookup) returns last tag
    asMock(Tag.findOne).mockReturnValueOnce({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ sortOrder: 5 }),
      }),
    });
    const created = { _id: VALID_ID, path: "Groceries", sortOrder: 6 };
    asMock(Tag.create).mockResolvedValue(created);

    const res = await POST(makeJsonRequest("/api/tags/create-inline", {}));
    const body = await expectStatus(res, 201);
    expect(body.tag.path).toBe("Groceries");
  });

  it("returns 200 on race condition duplicate", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ path: "Groceries" }));
    // First findOne (collation check) returns null
    asMock(Tag.findOne).mockReturnValueOnce({
      collation: jest.fn().mockResolvedValue(null),
    });
    // Second findOne (sortOrder lookup)
    asMock(Tag.findOne).mockReturnValueOnce({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ sortOrder: 5 }),
      }),
    });
    asMock(Tag.create).mockRejectedValue(new Error("duplicate"));
    asMock(isDuplicateKeyError).mockReturnValue(true);
    // Third findOne (race condition recovery)
    const found = { _id: VALID_ID, path: "Groceries", sortOrder: 6 };
    asMock(Tag.findOne).mockReturnValueOnce({
      collation: jest.fn().mockResolvedValue(found),
    });

    const res = await POST(makeJsonRequest("/api/tags/create-inline", {}));
    const body = await expectStatus(res, 200);
    expect(body.tag.path).toBe("Groceries");
  });

  it("re-throws when isDuplicateKeyError true but findOne returns null", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ path: "Groceries" }));
    // First findOne (collation check) returns null
    asMock(Tag.findOne).mockReturnValueOnce({
      collation: jest.fn().mockResolvedValue(null),
    });
    // Second findOne (sortOrder lookup)
    asMock(Tag.findOne).mockReturnValueOnce({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });
    const error = new Error("duplicate");
    asMock(Tag.create).mockRejectedValue(error);
    asMock(isDuplicateKeyError).mockReturnValue(true);
    // Third findOne (race condition recovery) returns null
    asMock(Tag.findOne).mockReturnValueOnce({
      collation: jest.fn().mockResolvedValue(null),
    });

    await expect(POST(makeJsonRequest("/api/tags/create-inline", {}))).rejects.toThrow("duplicate");
  });
});
