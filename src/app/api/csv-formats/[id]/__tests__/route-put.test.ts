import {
  makeSession,
  makeAdminSession,
  asMock,
  makeJsonRequest,
  makeIdContext,
  makeParsedSuccess,
  makeParsedFailure,
  makeCsvFormat,
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
import { csvFormatApiSchema } from "@/lib/validations/csv-format";
import { isDuplicateKeyError } from "@/lib/utils";
import { PUT } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(csvFormatApiSchema.safeParse);

function putRequest() {
  return makeJsonRequest(`/api/csv-formats/${VALID_ID}`, {}, "PUT");
}

describe("PUT /api/csv-formats/[id]", () => {
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

  it("returns 404 when format not found", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(makeCsvFormat()));
    asMock(CsvFormat.findByIdAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 404, "Format not found");
  });

  it("returns 409 when name already exists", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(makeCsvFormat()));
    asMock(CsvFormat.findByIdAndUpdate).mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error("duplicate")),
    });
    asMock(isDuplicateKeyError).mockReturnValue(true);

    const res = await PUT(putRequest(), makeIdContext());
    await expectError(res, 409, "already exists");
  });

  it("returns 200 on success", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    const data = makeCsvFormat({ name: "Citi" });
    mockSafeParse.mockReturnValue(makeParsedSuccess(data));
    asMock(CsvFormat.findByIdAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue(data),
    });

    const res = await PUT(putRequest(), makeIdContext());
    const body = await expectStatus(res, 200);
    expect(body.format.name).toBe("Citi");
  });
});
