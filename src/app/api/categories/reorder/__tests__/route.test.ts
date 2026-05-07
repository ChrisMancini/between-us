import {
  makeSession,
  makeAdminSession,
  asMock,
  makeJsonRequest,
  makeParsedSuccess,
  makeParsedFailure,
  makeCategory,
  mockChain,
  VALID_ID,
  VALID_ID_2,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/category", () => ({
  Category: { find: jest.fn(), countDocuments: jest.fn(), bulkWrite: jest.fn() },
}));
jest.mock("@/lib/validations/category", () => ({
  categoryReorderSchema: { safeParse: jest.fn() },
}));

import { auth } from "@/auth";
import { Category } from "@/lib/models/category";
import { categoryReorderSchema } from "@/lib/validations/category";
import { PUT } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(categoryReorderSchema.safeParse);

describe("PUT /api/categories/reorder", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PUT(makeJsonRequest("/api/categories/reorder", {}, "PUT"));
    await expectStatus(res, 401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("user"));
    const res = await PUT(makeJsonRequest("/api/categories/reorder", {}, "PUT"));
    await expectError(res, 403, "Forbidden");
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await PUT(makeJsonRequest("/api/categories/reorder", {}, "PUT"));
    await expectError(res, 400, "Validation failed");
  });

  it("returns 400 for invalid ObjectId in list", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ orderedIds: [VALID_ID, "bad-id"] })
    );
    const res = await PUT(makeJsonRequest("/api/categories/reorder", {}, "PUT"));
    await expectError(res, 400, "Invalid category ID");
  });

  it("returns 422 when count does not match", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ orderedIds: [VALID_ID] })
    );
    asMock(Category.countDocuments).mockResolvedValue(3);

    const res = await PUT(makeJsonRequest("/api/categories/reorder", {}, "PUT"));
    await expectError(res, 422, "out of date");
  });

  it("returns 200 with reordered categories", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ orderedIds: [VALID_ID_2, VALID_ID] })
    );
    asMock(Category.countDocuments).mockResolvedValue(2);
    asMock(Category.bulkWrite).mockResolvedValue({});
    asMock(Category.find).mockReturnValue(
      mockChain([
        makeCategory({ _id: VALID_ID_2, sortOrder: 1, name: "Bills" }),
        makeCategory({ _id: VALID_ID, sortOrder: 2, name: "Groceries" }),
      ])
    );

    const res = await PUT(makeJsonRequest("/api/categories/reorder", {}, "PUT"));
    const body = await expectStatus(res, 200);
    expect(body.categories).toHaveLength(2);
    expect(body.categories[0].name).toBe("Bills");
  });
});
