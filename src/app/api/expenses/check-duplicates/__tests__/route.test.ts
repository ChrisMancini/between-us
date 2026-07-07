import {
  makeSession,
  asMock,
  makeGetRequest,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/expense", () => ({
  Expense: { find: jest.fn() },
}));

import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { GET } from "../route";

const mockAuth = asMock(auth);

describe("GET /api/expenses/check-duplicates", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/expenses/check-duplicates"));
    await expectStatus(res, 401);
  });

  it("returns 400 when dates are missing", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await GET(makeGetRequest("/api/expenses/check-duplicates"));
    await expectError(res, 400, "startDate and endDate are required");
  });

  it("returns 400 for invalid date format", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await GET(
      makeGetRequest("/api/expenses/check-duplicates", {
        startDate: "not-a-date",
        endDate: "also-bad",
      })
    );
    await expectError(res, 400, "Invalid date format");
  });

  it("returns 200 with matching expenses", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const expense = {
      date: new Date(Date.UTC(2026, 3, 15)),
      amount: 5000,
      where: "Publix",
    };
    asMock(Expense.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([expense]),
    });

    const res = await GET(
      makeGetRequest("/api/expenses/check-duplicates", {
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      })
    );
    const body = await expectStatus(res, 200);
    expect(body.expenses).toHaveLength(1);
    expect(body.expenses[0].where).toBe("Publix");
  });

  it("adds _id $ne filter when excludeId is a valid ObjectId", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Expense.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const excludeId = "507f1f77bcf86cd799439011";
    await GET(
      makeGetRequest("/api/expenses/check-duplicates", {
        startDate: "2026-04-01",
        endDate: "2026-04-30",
        excludeId,
      })
    );

    const filter = asMock(Expense.find).mock.calls[0][0];
    expect(filter._id).toBeDefined();
    expect(filter._id.$ne.toString()).toBe(excludeId);
  });

  it("ignores excludeId when it is not a valid ObjectId", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Expense.find).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    await GET(
      makeGetRequest("/api/expenses/check-duplicates", {
        startDate: "2026-04-01",
        endDate: "2026-04-30",
        excludeId: "not-an-object-id",
      })
    );

    const filter = asMock(Expense.find).mock.calls[0][0];
    expect(filter._id).toBeUndefined();
  });
});
