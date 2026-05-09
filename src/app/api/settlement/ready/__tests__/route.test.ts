import {
  makeSession,
  asMock,
  makeJsonRequest,
  makeGetRequest,
  makeReadiness,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/settlement", () => ({
  Settlement: { findOne: jest.fn() },
}));
jest.mock("@/lib/models/month-readiness", () => ({
  MonthReadiness: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));

import { auth } from "@/auth";
import { Settlement } from "@/lib/models/settlement";
import { MonthReadiness } from "@/lib/models/month-readiness";
import { logActivity } from "@/lib/activity-logger";
import { GET, POST } from "../route";

const mockAuth = asMock(auth);

describe("GET /api/settlement/ready", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/settlement/ready", { month: "4", year: "2026" }));
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid month", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await GET(makeGetRequest("/api/settlement/ready", { month: "abc", year: "2026" }));
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns 400 for missing month", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await GET(makeGetRequest("/api/settlement/ready", { year: "2026" }));
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns 400 for month out of range (0)", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await GET(makeGetRequest("/api/settlement/ready", { month: "0", year: "2026" }));
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns 400 for month out of range (13)", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await GET(makeGetRequest("/api/settlement/ready", { month: "13", year: "2026" }));
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns doneBy from existing doc", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(MonthReadiness.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue(makeReadiness({ doneBy: ["john"] })),
    });
    const res = await GET(makeGetRequest("/api/settlement/ready", { month: "4", year: "2026" }));
    const body = await expectStatus(res, 200);
    expect(body.doneBy).toEqual(["john"]);
  });

  it("returns empty array when no doc exists", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(MonthReadiness.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    const res = await GET(makeGetRequest("/api/settlement/ready", { month: "4", year: "2026" }));
    const body = await expectStatus(res, 200);
    expect(body.doneBy).toEqual([]);
  });
});

describe("POST /api/settlement/ready", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/settlement/ready", { month: 4, year: 2026 }));
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid month/year", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await POST(makeJsonRequest("/api/settlement/ready", { month: "abc", year: 2026 }));
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns 400 for month < 1", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await POST(makeJsonRequest("/api/settlement/ready", { month: 0, year: 2026 }));
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns 400 for month > 12", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await POST(makeJsonRequest("/api/settlement/ready", { month: 13, year: 2026 }));
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns 409 when month is closed", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ month: 4, year: 2026, status: "closed" }),
    });
    const res = await POST(makeJsonRequest("/api/settlement/ready", { month: 4, year: 2026 }));
    await expectError(res, 409, "Month is closed");
  });

  it("marks as done when not yet done (upserts)", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    asMock(MonthReadiness.findOne).mockResolvedValue(null);
    asMock(MonthReadiness.findOneAndUpdate).mockResolvedValue(
      makeReadiness({ doneBy: ["john"] })
    );

    const res = await POST(makeJsonRequest("/api/settlement/ready", { month: 4, year: 2026 }));
    const body = await expectStatus(res, 200);
    expect(body.toggled).toBe("done");
    expect(body.doneBy).toEqual(["john"]);
    expect(MonthReadiness.findOneAndUpdate).toHaveBeenCalledWith(
      { month: 4, year: 2026 },
      { $addToSet: { doneBy: "john" } },
      { new: true, upsert: true }
    );
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "expenses_done",
      expect.stringContaining("done"),
      expect.objectContaining({ month: 4, year: 2026 })
    );
  });

  it("unmarks when already done", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    asMock(MonthReadiness.findOne).mockResolvedValue(
      makeReadiness({ doneBy: ["john", "jane"] })
    );
    asMock(MonthReadiness.findOneAndUpdate).mockResolvedValue(
      makeReadiness({ doneBy: ["jane"] })
    );

    const res = await POST(makeJsonRequest("/api/settlement/ready", { month: 4, year: 2026 }));
    const body = await expectStatus(res, 200);
    expect(body.toggled).toBe("undone");
    expect(body.doneBy).toEqual(["jane"]);
    expect(MonthReadiness.findOneAndUpdate).toHaveBeenCalledWith(
      { month: 4, year: 2026 },
      { $pull: { doneBy: "john" } },
      { new: true }
    );
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "expenses_undone",
      expect.stringContaining("unmarked"),
      expect.objectContaining({ month: 4, year: 2026 })
    );
  });

  it("returns empty doneBy when update returns null", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    asMock(MonthReadiness.findOne).mockResolvedValue(null);
    asMock(MonthReadiness.findOneAndUpdate).mockResolvedValue(null);

    const res = await POST(makeJsonRequest("/api/settlement/ready", { month: 4, year: 2026 }));
    const body = await expectStatus(res, 200);
    expect(body.doneBy).toEqual([]);
  });
});
