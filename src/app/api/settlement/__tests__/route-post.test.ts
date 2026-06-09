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
jest.mock("@/lib/models/expense", () => ({
  Expense: { find: jest.fn() },
}));
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
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { calculateSettlement } from "@/lib/settlement-calc";
import { getPersons } from "@/lib/persons";
import { logActivity } from "@/lib/activity-logger";
import { POST } from "../route";

const mockAuth = asMock(auth);

const breakdown = {
  netAmount: 5000,
  netOwedBy: "john",
};

function setupCommonMocks() {
  asMock(getPersons).mockResolvedValue([
    { key: "john" },
    { key: "jane" },
  ]);
  asMock(Expense.find).mockReturnValue({
    populate: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    }),
  });
  asMock(calculateSettlement).mockReturnValue(breakdown);
}

describe("POST /api/settlement", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest("/api/settlement", { month: 4, year: 2026 })
    );
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid month/year", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await POST(
      makeJsonRequest("/api/settlement", { month: "abc", year: 2026 })
    );
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns 409 when month is already closed", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockResolvedValue({ status: "closed" });
    const res = await POST(
      makeJsonRequest("/api/settlement", { month: 4, year: 2026 })
    );
    await expectError(res, 409, "already closed");
  });

  it("returns 201 when creating new settlement", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockResolvedValue(null);
    setupCommonMocks();
    const created = {
      _id: VALID_ID,
      month: 4,
      year: 2026,
      status: "closed",
      totalOwed: 5000,
      owedBy: "john",
      owedTo: "jane",
      closedAt: new Date(),
    };
    asMock(Settlement.create).mockResolvedValue(created);

    const res = await POST(
      makeJsonRequest("/api/settlement", { month: 4, year: 2026 })
    );
    const body = await expectStatus(res, 201);
    expect(body.settlement.totalOwed).toBe(5000);
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "settlement_close",
      expect.stringContaining("closed"),
      expect.objectContaining({ month: 4, year: 2026 })
    );
  });

  it("returns 200 when re-closing an open settlement", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const existing = { _id: VALID_ID, status: "open" };
    asMock(Settlement.findOne).mockResolvedValue(existing);
    setupCommonMocks();
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

    const res = await POST(
      makeJsonRequest("/api/settlement", { month: 4, year: 2026 })
    );
    await expectStatus(res, 200);
  });
});
