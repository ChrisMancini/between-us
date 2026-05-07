import {
  makeSession,
  makeAdminSession,
  asMock,
  makeParsedSuccess,
  makeParsedFailure,
  makeJsonRequest,
  makeCategory,
  VALID_ID,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/category", () => ({
  Category: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), countDocuments: jest.fn(), bulkWrite: jest.fn() },
}));
jest.mock("@/lib/category-seed", () => ({ seedCategoriesIfEmpty: jest.fn() }));
jest.mock("@/lib/utils", () => ({ isDuplicateKeyError: jest.fn() }));
jest.mock("@/lib/validations/category", () => ({
  categoryApiSchema: { safeParse: jest.fn() },
}));

import { auth } from "@/auth";
import { Category } from "@/lib/models/category";
import { categoryApiSchema } from "@/lib/validations/category";
import { isDuplicateKeyError } from "@/lib/utils";
import { POST } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(categoryApiSchema.safeParse);

describe("POST /api/categories", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/categories", {}));
    await expectStatus(res, 401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("user"));
    const res = await POST(makeJsonRequest("/api/categories", {}));
    await expectError(res, 403, "Forbidden");
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await POST(makeJsonRequest("/api/categories", {}));
    await expectError(res, 400, "Validation failed");
  });

  it("returns 409 when name already exists", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ name: "Groceries", settlementType: "deferred" })
    );
    asMock(Category.findOne).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeCategory({ sortOrder: 3 })),
      }),
    });
    asMock(Category.create).mockRejectedValue(new Error("duplicate"));
    asMock(isDuplicateKeyError).mockReturnValue(true);

    const res = await POST(makeJsonRequest("/api/categories", {}));
    await expectError(res, 409, "already exists");
  });

  it("returns 201 on success", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ name: "Travel", settlementType: "deferred" })
    );
    asMock(Category.findOne).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(makeCategory({ sortOrder: 3 })),
      }),
    });
    asMock(Category.create).mockResolvedValue({
      _id: VALID_ID,
      name: "Travel",
      settlementType: "deferred",
      sortOrder: 4,
    });

    const res = await POST(makeJsonRequest("/api/categories", {}));
    const body = await expectStatus(res, 201);
    expect(body.category.name).toBe("Travel");
    expect(body.category.sortOrder).toBe(4);
  });
});
