import {
  makeSession,
  asMock,
  makeJsonRequest,
  VALID_ID,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/lib/action-lifecycle", () => ({
  createActionForSettlement: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/settlement", () => ({
  Settlement: {
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock("@/lib/settlement-calc", () => ({
  calculateSettlement: jest.fn(),
}));
jest.mock("@/lib/persons", () => ({
  getPersons: jest.fn(),
}));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));
jest.mock("@/lib/models/month-readiness", () => ({
  MonthReadiness: { deleteOne: jest.fn().mockResolvedValue({}) },
}));

import { auth } from "@/auth";
import { Settlement } from "@/lib/models/settlement";
import { PATCH } from "../route";

const mockAuth = asMock(auth);

describe("PATCH /api/settlement", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(
      makeJsonRequest("/api/settlement", { month: 4, year: 2026, note: "Zelle" }, "PATCH")
    );
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid month/year", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await PATCH(
      makeJsonRequest("/api/settlement", { month: "abc", year: 2026, note: "Zelle" }, "PATCH")
    );
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns 400 when note is not a string", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await PATCH(
      makeJsonRequest("/api/settlement", { month: 4, year: 2026 }, "PATCH")
    );
    await expectError(res, 400, "Note is required");
  });

  it("returns 404 when no settlement found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockResolvedValue(null);
    const res = await PATCH(
      makeJsonRequest("/api/settlement", { month: 4, year: 2026, note: "Zelle" }, "PATCH")
    );
    await expectError(res, 404, "No settlement found");
  });

  it("updates note on an existing settlement", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockResolvedValue({ _id: VALID_ID, status: "closed" });
    const updated = {
      _id: VALID_ID,
      month: 4,
      year: 2026,
      status: "closed",
      totalOwed: 5000,
      owedBy: "john",
      owedTo: "jane",
      closedAt: new Date(),
      note: "Paid via Zelle",
    };
    asMock(Settlement.findByIdAndUpdate).mockResolvedValue(updated);

    const res = await PATCH(
      makeJsonRequest("/api/settlement", { month: 4, year: 2026, note: "Paid via Zelle" }, "PATCH")
    );
    const body = await expectStatus(res, 200);
    expect(body.settlement.note).toBe("Paid via Zelle");
    expect(Settlement.findByIdAndUpdate).toHaveBeenCalledWith(
      VALID_ID,
      { $set: { note: "Paid via Zelle" } },
      { returnDocument: "after" }
    );
  });

  it("clears note when empty string is sent", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockResolvedValue({ _id: VALID_ID, status: "closed" });
    const updated = {
      _id: VALID_ID,
      month: 4,
      year: 2026,
      status: "closed",
      totalOwed: 5000,
      owedBy: "john",
      owedTo: "jane",
      closedAt: new Date(),
    };
    asMock(Settlement.findByIdAndUpdate).mockResolvedValue(updated);

    const res = await PATCH(
      makeJsonRequest("/api/settlement", { month: 4, year: 2026, note: "" }, "PATCH")
    );
    const body = await expectStatus(res, 200);
    expect(body.settlement.note).toBeUndefined();
    expect(Settlement.findByIdAndUpdate).toHaveBeenCalledWith(
      VALID_ID,
      { $unset: { note: 1 } },
      { returnDocument: "after" }
    );
  });
});
