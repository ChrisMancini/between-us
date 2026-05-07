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
jest.mock("@/lib/models/csv-format", () => ({
  CsvFormat: { findByIdAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() },
}));
jest.mock("@/lib/utils", () => ({ isDuplicateKeyError: jest.fn() }));
jest.mock("@/lib/validations/csv-format", () => ({
  csvFormatApiSchema: { safeParse: jest.fn() },
}));

import { auth } from "@/auth";
import { CsvFormat } from "@/lib/models/csv-format";
import { DELETE } from "../route";

const mockAuth = asMock(auth);

function deleteRequest() {
  return makeRequest(`/api/csv-formats/${VALID_ID}`, { method: "DELETE" });
}

describe("DELETE /api/csv-formats/[id]", () => {
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

  it("returns 404 when format not found", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(CsvFormat.findByIdAndDelete).mockResolvedValue(null);
    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectError(res, 404, "Format not found");
  });

  it("returns 200 on success", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(CsvFormat.findByIdAndDelete).mockResolvedValue({ _id: VALID_ID });
    const res = await DELETE(deleteRequest(), makeIdContext());
    const body = await expectStatus(res, 200);
    expect(body.ok).toBe(true);
  });
});
