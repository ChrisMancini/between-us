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
  Tag: { find: jest.fn(), findOne: jest.fn(), create: jest.fn() },
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
import { ensureAncestors } from "@/lib/tag-utils";
import { POST } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(tagApiSchema.safeParse);

describe("POST /api/tags", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/tags", {}));
    await expectStatus(res, 401);
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await POST(makeJsonRequest("/api/tags", {}));
    await expectError(res, 400, "Validation failed");
  });

  it("returns 409 on duplicate key", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ path: "Groceries" }));
    asMock(Tag.findOne).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ sortOrder: 3 }),
      }),
    });
    asMock(Tag.create).mockRejectedValue(new Error("duplicate"));
    asMock(isDuplicateKeyError).mockReturnValue(true);

    const res = await POST(makeJsonRequest("/api/tags", {}));
    await expectError(res, 409, "already exists");
  });

  it("returns 201 on success", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ path: "Groceries" }));
    asMock(Tag.findOne).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ sortOrder: 3 }),
      }),
    });
    const created = { _id: VALID_ID, path: "Groceries", sortOrder: 4 };
    asMock(Tag.create).mockResolvedValue(created);

    const res = await POST(makeJsonRequest("/api/tags", {}));
    const body = await expectStatus(res, 201);
    expect(body.tag.path).toBe("Groceries");
    expect(ensureAncestors).toHaveBeenCalledWith("Groceries");
  });

  it("re-throws non-duplicate errors", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ path: "Groceries" }));
    asMock(Tag.findOne).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });
    const error = new Error("something else");
    asMock(Tag.create).mockRejectedValue(error);
    asMock(isDuplicateKeyError).mockReturnValue(false);

    await expect(POST(makeJsonRequest("/api/tags", {}))).rejects.toThrow("something else");
  });
});
