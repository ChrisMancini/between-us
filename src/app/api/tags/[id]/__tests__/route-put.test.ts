import {
  makeSession,
  makeAdminSession,
  asMock,
  makeParsedSuccess,
  makeParsedFailure,
  makeJsonRequest,
  makeIdContext,
  VALID_ID,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/tag", () => ({
  Tag: { findById: jest.fn(), findByIdAndUpdate: jest.fn(), find: jest.fn() },
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
import { tagApiSchema } from "@/lib/validations/tag";
import { isDuplicateKeyError } from "@/lib/utils";
import { PUT } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(tagApiSchema.safeParse);

function putRequest() {
  return makeJsonRequest(`/api/tags/${VALID_ID}`, {}, "PUT");
}

describe("PUT /api/tags/[id]", () => {
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

  it("returns 400 for invalid ID", async () => {
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

  it("returns 404 when tag not found", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ path: "Bills" }));
    asMock(Tag.findById).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 404, "Tag not found");
  });

  it("returns 409 on duplicate key error", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ path: "Bills" }));
    asMock(Tag.findById).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: VALID_ID, path: "Utilities", sortOrder: 1 }),
    });
    asMock(Tag.findByIdAndUpdate).mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error("duplicate")),
    });
    asMock(isDuplicateKeyError).mockReturnValue(true);

    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 409, "already exists");
  });

  it("returns 200 on success", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ path: "Bills" }));
    asMock(Tag.findById).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: VALID_ID, path: "Utilities", sortOrder: 1 }),
    });
    const updated = { _id: VALID_ID, path: "Bills", sortOrder: 1 };
    asMock(Tag.findByIdAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue(updated),
    });
    asMock(Tag.find).mockResolvedValue([]);

    const res = await PUT(putRequest(), makeIdContext());
    const body = await expectStatus(res, 200);
    expect(body.tag.path).toBe("Bills");
  });

  it("re-throws non-duplicate errors", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess({ path: "Bills" }));
    asMock(Tag.findById).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: VALID_ID, path: "Utilities", sortOrder: 1 }),
    });
    const error = new Error("something else");
    asMock(Tag.findByIdAndUpdate).mockReturnValue({
      lean: jest.fn().mockRejectedValue(error),
    });
    asMock(isDuplicateKeyError).mockReturnValue(false);

    await expect(PUT(putRequest(), makeIdContext())).rejects.toThrow("something else");
  });
});
