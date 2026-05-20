import {
  makeSession,
  asMock,
  mockChain,
  makeGetRequest,
  expectStatus,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/tag", () => ({
  Tag: { find: jest.fn() },
}));
jest.mock("@/lib/utils", () => ({ isDuplicateKeyError: jest.fn() }));
jest.mock("@/lib/validations/tag", () => ({ tagApiSchema: {} }));
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
import { GET } from "../route";

const mockAuth = asMock(auth);

describe("GET /api/tags", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/tags"));
    await expectStatus(res, 401);
  });

  it("returns 200 with tags", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const tag = { _id: "507f1f77bcf86cd799439011", path: "Groceries", sortOrder: 1 };
    asMock(Tag.find).mockReturnValue(mockChain([tag]));

    const res = await GET(makeGetRequest("/api/tags"));
    const body = await expectStatus(res, 200);
    expect(body.tags).toHaveLength(1);
    expect(body.tags[0].path).toBe("Groceries");
  });
});
