import {
  makeSession,
  asMock,
  makeCategory,
  mockChain,
  makeGetRequest,
  expectStatus,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/category", () => ({
  Category: { find: jest.fn(), countDocuments: jest.fn(), bulkWrite: jest.fn() },
}));
jest.mock("@/lib/category-seed", () => ({ seedCategoriesIfEmpty: jest.fn() }));
jest.mock("@/lib/utils", () => ({ isDuplicateKeyError: jest.fn() }));
jest.mock("@/lib/validations/category", () => ({ categoryApiSchema: {} }));

import { auth } from "@/auth";
import { Category } from "@/lib/models/category";
import { GET } from "../route";

const mockAuth = asMock(auth);

describe("GET /api/categories", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/categories"));
    await expectStatus(res, 401);
  });

  it("returns 200 with sorted categories", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const cats = [
      makeCategory({ sortOrder: 1, name: "Bills" }),
      makeCategory({ sortOrder: 2, name: "Groceries" }),
    ];
    asMock(Category.find).mockReturnValue(mockChain(cats));

    const res = await GET(makeGetRequest("/api/categories"));
    const body = await expectStatus(res, 200);
    expect(body.categories).toHaveLength(2);
    expect(body.categories[0].name).toBe("Bills");
  });
});
