import {
  makeSession,
  asMock,
  makeSettlement,
  makeGetRequest,
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
  Settlement: { findOne: jest.fn() },
}));
jest.mock("@/lib/settlement-calc", () => ({
  calculateSettlement: jest.fn(),
}));
jest.mock("@/lib/persons", () => ({
  getPersons: jest.fn(),
}));

import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { Settlement } from "@/lib/models/settlement";
import { calculateSettlement } from "@/lib/settlement-calc";
import { getPersons } from "@/lib/persons";
import { GET } from "../route";

const mockAuth = asMock(auth);

describe("GET /api/settlement", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/settlement"));
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid month/year", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await GET(
      makeGetRequest("/api/settlement", { month: "abc", year: "2026" })
    );
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns 400 when month is out of range", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await GET(
      makeGetRequest("/api/settlement", { month: "13", year: "2026" })
    );
    await expectError(res, 400, "Invalid month/year");
  });

  it("returns closed settlement when month is closed", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const settlement = makeSettlement();
    asMock(Settlement.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue(settlement),
    });

    const res = await GET(
      makeGetRequest("/api/settlement", { month: "4", year: "2026" })
    );
    const body = await expectStatus(res, 200);
    expect(body.status).toBe("closed");
    expect(body.settlement.totalOwed).toBe(10000);
  });

  it("includes note in closed settlement response", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const settlement = makeSettlement({ note: "Venmo'd on 7/3" });
    asMock(Settlement.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue(settlement),
    });

    const res = await GET(
      makeGetRequest("/api/settlement", { month: "4", year: "2026" })
    );
    const body = await expectStatus(res, 200);
    expect(body.settlement.note).toBe("Venmo'd on 7/3");
  });

  it("includes note in previousSettlement for reopened month", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const reopened = makeSettlement({
      status: "open",
      previousTotalOwed: 10000,
      previousOwedBy: "john",
      note: "Original Zelle payment",
    });
    asMock(Settlement.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue(reopened),
    });
    asMock(getPersons).mockResolvedValue([
      { key: "john" },
      { key: "jane" },
    ]);
    asMock(Expense.find).mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });
    asMock(calculateSettlement).mockReturnValue({
      netAmount: 0,
      netOwedBy: "even",
    });

    const res = await GET(
      makeGetRequest("/api/settlement", { month: "4", year: "2026" })
    );
    const body = await expectStatus(res, 200);
    expect(body.status).toBe("open");
    expect(body.previousSettlement.note).toBe("Original Zelle payment");
  });

  it("returns open breakdown when month is open", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Settlement.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    asMock(getPersons).mockResolvedValue([
      { key: "john" },
      { key: "jane" },
    ]);
    asMock(Expense.find).mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });
    asMock(calculateSettlement).mockReturnValue({
      netAmount: 0,
      netOwedBy: "even",
    });

    const res = await GET(
      makeGetRequest("/api/settlement", { month: "4", year: "2026" })
    );
    const body = await expectStatus(res, 200);
    expect(body.status).toBe("open");
    expect(body.breakdown.netAmount).toBe(0);
  });
});
