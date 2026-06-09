import {
  makeSession,
  asMock,
  makeGetRequest,
  expectStatus,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/action", () => ({
  Action: { countDocuments: jest.fn() },
}));

import { auth } from "@/auth";
import { Action } from "@/lib/models/action";
import { GET } from "../route";

const mockAuth = asMock(auth);
const mockCount = asMock(Action.countDocuments);

describe("GET /api/actions/count", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/actions/count"));
    await expectStatus(res, 401);
  });

  it("returns correct count for debtor (pending) and creditor (paid)", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockCount.mockResolvedValue(3);

    const res = await GET(makeGetRequest("/api/actions/count"));
    const body = await expectStatus(res, 200);

    expect(body.count).toBe(3);
    expect(mockCount).toHaveBeenCalledWith({
      $or: [
        { debtorKey: "john", status: "pending" },
        { creditorKey: "john", status: { $in: ["pending", "paid"] } },
      ],
    });
  });

  it("returns 0 when no actions need attention", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockCount.mockResolvedValue(0);

    const res = await GET(makeGetRequest("/api/actions/count"));
    const body = await expectStatus(res, 200);
    expect(body.count).toBe(0);
  });
});
