import {
  makeSession,
  asMock,
  makeCsvFormat,
  mockChain,
  makeGetRequest,
  expectStatus,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/csv-format", () => ({
  CsvFormat: { find: jest.fn() },
}));
jest.mock("@/lib/utils", () => ({ isDuplicateKeyError: jest.fn() }));
jest.mock("@/lib/validations/csv-format", () => ({ csvFormatApiSchema: {} }));

import { auth } from "@/auth";
import { CsvFormat } from "@/lib/models/csv-format";
import { GET } from "../route";

const mockAuth = asMock(auth);

describe("GET /api/csv-formats", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/csv-formats"));
    await expectStatus(res, 401);
  });

  it("returns 200 with formats", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(CsvFormat.find).mockReturnValue(mockChain([makeCsvFormat()]));

    const res = await GET(makeGetRequest("/api/csv-formats"));
    const body = await expectStatus(res, 200);
    expect(body.formats).toHaveLength(1);
    expect(body.formats[0].name).toBe("Chase");
  });
});
