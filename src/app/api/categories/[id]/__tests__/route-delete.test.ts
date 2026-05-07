import {
  makeSession,
  makeAdminSession,
  asMock,
  makeRequest,
  makeIdContext,
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
import { Expense } from "@/lib/models/expense";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { DELETE } from "../route";

const mockAuth = asMock(auth);

function deleteRequest() {
  return makeRequest(`/api/categories/${VALID_ID}`, { method: "DELETE" });
}

describe("DELETE /api/categories/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectStatus(res, 401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("user"));
    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectError(res, 403, "Forbidden");
  });

  it("returns 400 for invalid ObjectId", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    const res = await DELETE(deleteRequest(), makeIdContext("not-an-id"));
    await expectError(res, 400, "Invalid ID");
  });

  it("returns 409 when category is referenced by expenses", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(Expense.countDocuments).mockResolvedValue(5);
    asMock(RecurringTemplate.countDocuments).mockResolvedValue(0);

    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectError(res, 409, "5 expense(s)");
  });

  it("returns 409 when category is referenced by templates", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(Expense.countDocuments).mockResolvedValue(0);
    asMock(RecurringTemplate.countDocuments).mockResolvedValue(2);

    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectError(res, 409, "2 template(s)");
  });

  it("returns 404 when category not found", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(Expense.countDocuments).mockResolvedValue(0);
    asMock(RecurringTemplate.countDocuments).mockResolvedValue(0);
    asMock(Category.findByIdAndDelete).mockResolvedValue(null);

    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectError(res, 404, "Category not found");
  });

  it("returns 200 and re-normalizes sort order on success", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(Expense.countDocuments).mockResolvedValue(0);
    asMock(RecurringTemplate.countDocuments).mockResolvedValue(0);
    asMock(Category.findByIdAndDelete).mockResolvedValue({ _id: VALID_ID });
    asMock(Category.find).mockReturnValue({
      sort: jest.fn().mockResolvedValue([{ _id: "a" }, { _id: "b" }]),
    });
    asMock(Category.bulkWrite).mockResolvedValue({});

    const res = await DELETE(deleteRequest(), makeIdContext());
    const body = await expectStatus(res, 200);
    expect(body.ok).toBe(true);
    expect(asMock(Category.bulkWrite)).toHaveBeenCalled();
  });
});
