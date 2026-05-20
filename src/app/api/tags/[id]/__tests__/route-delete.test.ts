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
jest.mock("@/lib/models/tag", () => ({
  Tag: { findById: jest.fn(), findByIdAndDelete: jest.fn(), find: jest.fn(), bulkWrite: jest.fn() },
}));
jest.mock("@/lib/models/expense", () => ({
  Expense: { countDocuments: jest.fn() },
}));
jest.mock("@/lib/models/recurring-template", () => ({
  RecurringTemplate: { countDocuments: jest.fn() },
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
import { Expense } from "@/lib/models/expense";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { DELETE } from "../route";

const mockAuth = asMock(auth);

function deleteRequest() {
  return makeRequest(`/api/tags/${VALID_ID}`, { method: "DELETE" });
}

describe("DELETE /api/tags/[id]", () => {
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

  it("returns 400 for invalid ID", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    const res = await DELETE(deleteRequest(), makeIdContext("not-an-id"));
    await expectError(res, 400, "Invalid ID");
  });

  it("returns 404 when tag not found", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(Tag.findById).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectError(res, 404, "Tag not found");
  });

  it("returns 409 when tag is used by expenses", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(Tag.findById).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: VALID_ID, path: "Groceries", sortOrder: 1 }),
    });
    asMock(Expense.countDocuments).mockResolvedValue(3);
    asMock(RecurringTemplate.countDocuments).mockResolvedValue(0);

    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectError(res, 409, "3 expense(s)");
  });

  it("returns 409 when tag is used by templates", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(Tag.findById).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: VALID_ID, path: "Groceries", sortOrder: 1 }),
    });
    asMock(Expense.countDocuments).mockResolvedValue(0);
    asMock(RecurringTemplate.countDocuments).mockResolvedValue(2);

    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectError(res, 409, "2 template(s)");
  });

  it("returns 200 on success", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(Tag.findById).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: VALID_ID, path: "Groceries", sortOrder: 1 }),
    });
    asMock(Expense.countDocuments).mockResolvedValue(0);
    asMock(RecurringTemplate.countDocuments).mockResolvedValue(0);
    asMock(Tag.findByIdAndDelete).mockResolvedValue({ _id: VALID_ID });
    const remaining = [
      { _id: "a1", sortOrder: 1 },
      { _id: "a2", sortOrder: 3 },
    ];
    asMock(Tag.find).mockReturnValue({
      sort: jest.fn().mockResolvedValue(remaining),
    });
    asMock(Tag.bulkWrite).mockResolvedValue({});

    const res = await DELETE(deleteRequest(), makeIdContext());
    const body = await expectStatus(res, 200);
    expect(body.ok).toBe(true);
    expect(Tag.bulkWrite).toHaveBeenCalled();
  });
});
