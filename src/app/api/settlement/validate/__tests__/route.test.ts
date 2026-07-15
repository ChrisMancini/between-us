import {
  makeSession,
  asMock,
  makeGetRequest,
  expectStatus,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/settlement", () => ({
  Settlement: { findOne: jest.fn() },
}));

import { auth } from "@/auth";
import { Settlement } from "@/lib/models/settlement";
import { HEAD, GET } from "../route";

const mockAuth = asMock(auth);
const mockFindOne = asMock(Settlement.findOne);

function mockSettle(result: unknown) {
  return {
    lean: jest.fn().mockResolvedValue(result),
  };
}

describe("GET/HEAD /api/settlement/validate", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("HEAD method", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await HEAD(
        makeGetRequest("/api/settlement/validate?month=1&year=2025")
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid month", async () => {
      mockAuth.mockResolvedValue(makeSession("user", "john"));
      const res = await HEAD(
        makeGetRequest("/api/settlement/validate?month=13&year=2025")
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing year", async () => {
      mockAuth.mockResolvedValue(makeSession("user", "john"));
      const res = await HEAD(
        makeGetRequest("/api/settlement/validate?month=1")
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 when settlement not found", async () => {
      mockAuth.mockResolvedValue(makeSession("user", "john"));
      mockFindOne.mockReturnValue(mockSettle(null));

      const res = await HEAD(
        makeGetRequest("/api/settlement/validate?month=1&year=2025")
      );
      expect(res.status).toBe(404);
      expect(mockFindOne).toHaveBeenCalledWith({ month: 1, year: 2025 });
    });

    it("returns 200 when settlement exists", async () => {
      mockAuth.mockResolvedValue(makeSession("user", "john"));
      mockFindOne.mockReturnValue(
        mockSettle({
          _id: "settlement-123",
          month: 1,
          year: 2025,
        })
      );

      const res = await HEAD(
        makeGetRequest("/api/settlement/validate?month=1&year=2025")
      );
      expect(res.status).toBe(200);
    });
  });

  describe("GET method", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const res = await GET(
        makeGetRequest("/api/settlement/validate?month=1&year=2025")
      );
      await expectStatus(res, 401);
    });

    it("returns 400 for invalid month", async () => {
      mockAuth.mockResolvedValue(makeSession("user", "john"));
      const res = await GET(
        makeGetRequest("/api/settlement/validate?month=13&year=2025")
      );
      const body = await expectStatus(res, 400);
      expect(body.error).toBe("Invalid month/year");
    });

    it("returns 404 when settlement not found", async () => {
      mockAuth.mockResolvedValue(makeSession("user", "john"));
      mockFindOne.mockReturnValue(mockSettle(null));

      const res = await GET(
        makeGetRequest("/api/settlement/validate?month=1&year=2025")
      );
      const body = await expectStatus(res, 404);
      expect(body.error).toBe("Settlement not found");
    });

    it("returns 200 with ok: true when settlement exists", async () => {
      mockAuth.mockResolvedValue(makeSession("user", "john"));
      mockFindOne.mockReturnValue(
        mockSettle({
          _id: "settlement-123",
          month: 1,
          year: 2025,
        })
      );

      const res = await GET(
        makeGetRequest("/api/settlement/validate?month=1&year=2025")
      );
      const body = await expectStatus(res, 200);
      expect(body.ok).toBe(true);
    });
  });
});
