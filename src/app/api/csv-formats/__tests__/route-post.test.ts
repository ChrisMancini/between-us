import {
  makeSession,
  makeAdminSession,
  asMock,
  makeParsedSuccess,
  makeParsedFailure,
  makeCsvFormat,
  makeJsonRequest,
  VALID_ID,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/csv-format", () => ({
  CsvFormat: { find: jest.fn(), create: jest.fn(), findById: jest.fn() },
}));
jest.mock("@/lib/utils", () => ({ isDuplicateKeyError: jest.fn() }));
jest.mock("@/lib/validations/csv-format", () => ({
  csvFormatApiSchema: { safeParse: jest.fn() },
}));

import { auth } from "@/auth";
import { CsvFormat } from "@/lib/models/csv-format";
import { csvFormatApiSchema } from "@/lib/validations/csv-format";
import { isDuplicateKeyError } from "@/lib/utils";
import { POST } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(csvFormatApiSchema.safeParse);

describe("POST /api/csv-formats", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/csv-formats", {}));
    await expectStatus(res, 401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("user"));
    const res = await POST(makeJsonRequest("/api/csv-formats", {}));
    await expectError(res, 403, "Forbidden");
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await POST(makeJsonRequest("/api/csv-formats", {}));
    await expectError(res, 400, "Validation failed");
  });

  it("returns 409 when name already exists", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    mockSafeParse.mockReturnValue(makeParsedSuccess(makeCsvFormat()));
    asMock(CsvFormat.create).mockRejectedValue(new Error("duplicate"));
    asMock(isDuplicateKeyError).mockReturnValue(true);

    const res = await POST(makeJsonRequest("/api/csv-formats", {}));
    await expectError(res, 409, "already exists");
  });

  it("returns 201 on success", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    const data = makeCsvFormat();
    mockSafeParse.mockReturnValue(makeParsedSuccess(data));
    asMock(CsvFormat.create).mockResolvedValue({ _id: VALID_ID });
    asMock(CsvFormat.findById).mockReturnValue({
      lean: jest.fn().mockResolvedValue(data),
    });

    const res = await POST(makeJsonRequest("/api/csv-formats", {}));
    const body = await expectStatus(res, 201);
    expect(body.format.name).toBe("Chase");
  });
});
