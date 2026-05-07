import {
  makeSession,
  makeAdminSession,
  asMock,
  makeJsonRequest,
  makeIdContext,
  makeParsedSuccess,
  makeParsedFailure,
  makeCategory,
  VALID_ID,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/category", () => ({
  Category: { findByIdAndUpdate: jest.fn(), findByIdAndDelete: jest.fn(), find: jest.fn(), bulkWrite: jest.fn() },
}));
jest.mock("@/lib/models/expense", () => ({
  Expense: { countDocuments: jest.fn() },
}));
jest.mock("@/lib/models/recurring-template", () => ({
  RecurringTemplate: { countDocuments: jest.fn() },
}));
jest.mock("@/lib/utils", () => ({ isDuplicateKeyError: jest.fn() }));
jest.mock("@/lib/validations/category", () => ({
  categoryApiSchema: { safeParse: jest.fn() },
}));

import { auth } from "@/auth";
import { Category } from "@/lib/models/category";
import { categoryApiSchema } from "@/lib/validations/category";
import { isDuplicateKeyError } from "@/lib/utils";
import { PUT } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(categoryApiSchema.safeParse);

function putRequest() {
  return makeJsonRequest(`/api/categories/${VALID_ID}`, {}, "PUT");
}

describe("PUT /api/categories/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PUT(putRequest(), makeIdContext());
    await expectStatus(res, 401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("user"));
    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 403, "Forbidden");
  });

  it("returns 400 for invalid ObjectId", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    const res = await PUT(putRequest(), makeIdContext("not-an-id"));
    await expectError(res, 400, "Invalid ID");
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 400, "Validation failed");
  });

  it("returns 404 when category not found", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ name: "Travel", settlementType: "deferred" })
    );
    asMock(Category.findByIdAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 404, "Category not found");
  });

  it("returns 409 when name already exists", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ name: "Groceries", settlementType: "deferred" })
    );
    asMock(Category.findByIdAndUpdate).mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error("duplicate")),
    });
    asMock(isDuplicateKeyError).mockReturnValue(true);

    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 409, "already exists");
  });

  it("returns 200 on success", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(
      makeParsedSuccess({ name: "Travel", settlementType: "deferred" })
    );
    const updated = makeCategory({ name: "Travel" });
    asMock(Category.findByIdAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue(updated),
    });

    const res = await PUT(putRequest(), makeIdContext());
    const body = await expectStatus(res, 200);
    expect(body.category.name).toBe("Travel");
  });
});
