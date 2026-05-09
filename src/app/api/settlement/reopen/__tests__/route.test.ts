import {
  makeSession,
  asMock,
  makeJsonRequest,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/settlement", () => ({
  Settlement: { findOne: jest.fn(), findByIdAndUpdate: jest.fn() },
}));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));
jest.mock("@/lib/models/month-readiness", () => ({
  MonthReadiness: { deleteOne: jest.fn().mockResolvedValue({}) },
}));

import { auth } from "@/auth";
import { Settlement } from "@/lib/models/settlement";
import { logActivity } from "@/lib/activity-logger";
import { POST } from "../route";

const mockAuth = asMock(auth);

describe("POST /api/settlement/reopen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest("/api/settlement/reopen", { month: 4, year: 2026 })
    );
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid month/year", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await POST(
      makeJsonRequest("/api/settlement/reopen", { month: "abc", year: 2026 })
    );
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns 404 when no settlement found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest("/api/settlement/reopen", { month: 4, year: 2026 })
    );
    await expectError(res, 404, "No settlement found");
  });

  it("returns 409 when month is already open", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockResolvedValue({ status: "open" });
    const res = await POST(
      makeJsonRequest("/api/settlement/reopen", { month: 4, year: 2026 })
    );
    await expectError(res, 409, "already open");
  });

  it("returns 200 and reopens the month", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockResolvedValue({
      _id: "abc",
      status: "closed",
      totalOwed: 5000,
      owedBy: "john",
    });
    asMock(Settlement.findByIdAndUpdate).mockResolvedValue({});

    const res = await POST(
      makeJsonRequest("/api/settlement/reopen", { month: 4, year: 2026 })
    );
    const body = await expectStatus(res, 200);
    expect(body.ok).toBe(true);
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "settlement_reopen",
      expect.stringContaining("reopened"),
      expect.objectContaining({ month: 4, year: 2026 })
    );
  });
});
