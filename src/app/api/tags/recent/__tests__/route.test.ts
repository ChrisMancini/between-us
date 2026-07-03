import {
  makeSession,
  asMock,
  makeGetRequest,
  expectStatus,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/expense", () => ({
  Expense: { aggregate: jest.fn() },
}));

import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { GET } from "../route";

const mockAuth = asMock(auth);

describe("GET /api/tags/recent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/tags/recent"));
    await expectStatus(res, 401);
  });

  it("returns the 5 most recently used tag IDs", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Expense.aggregate).mockResolvedValue([
      { _id: "tag-1", lastUsed: new Date("2026-07-01") },
      { _id: "tag-2", lastUsed: new Date("2026-06-28") },
      { _id: "tag-3", lastUsed: new Date("2026-06-25") },
      { _id: "tag-4", lastUsed: new Date("2026-06-20") },
      { _id: "tag-5", lastUsed: new Date("2026-06-15") },
    ]);

    const res = await GET(makeGetRequest("/api/tags/recent"));
    const body = await expectStatus(res, 200);
    expect(body.tagIds).toEqual(["tag-1", "tag-2", "tag-3", "tag-4", "tag-5"]);
  });

  it("returns empty array when user has no expenses", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Expense.aggregate).mockResolvedValue([]);

    const res = await GET(makeGetRequest("/api/tags/recent"));
    const body = await expectStatus(res, 200);
    expect(body.tagIds).toEqual([]);
  });

  it("filters by paidBy to exclude other user's expenses", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    asMock(Expense.aggregate).mockResolvedValue([
      { _id: "tag-1", lastUsed: new Date("2026-07-01") },
    ]);

    await GET(makeGetRequest("/api/tags/recent"));

    const pipeline = asMock(Expense.aggregate).mock.calls[0][0];
    expect(pipeline[0].$match.paidBy).toBe("john");
  });
});
