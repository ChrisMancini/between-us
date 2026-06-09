import {
  makeSession,
  asMock,
  makeGetRequest,
  expectStatus,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/action", () => {
  const serializeAction = (doc: Record<string, unknown>) => ({
    _id: String(doc._id),
    status: doc.status,
  });
  return {
    Action: {
      find: jest.fn(),
    },
    serializeAction,
  };
});

import { auth } from "@/auth";
import { Action } from "@/lib/models/action";
import { GET } from "../route";

const mockAuth = asMock(auth);
const mockFind = asMock(Action.find);

function chainResult(result: unknown[]) {
  return {
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe("GET /api/actions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/actions"));
    await expectStatus(res, 401);
  });

  it("returns active actions (pending + paid) by default", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFind.mockReturnValue(chainResult([
      { _id: "a1", status: "pending" },
      { _id: "a2", status: "paid" },
    ]));

    const res = await GET(makeGetRequest("/api/actions"));
    const body = await expectStatus(res, 200);

    expect(body.actions).toHaveLength(2);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $in: ["pending", "paid"] },
      })
    );
  });

  it("filters by specific status when provided", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFind.mockReturnValue(chainResult([{ _id: "a1", status: "confirmed" }]));

    const res = await GET(makeGetRequest("/api/actions", { status: "confirmed" }));
    const body = await expectStatus(res, 200);

    expect(body.actions).toHaveLength(1);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ status: "confirmed" })
    );
  });

  it("respects limit parameter", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFind.mockReturnValue(chainResult([]));

    await GET(makeGetRequest("/api/actions", { limit: "5" }));

    const chain = mockFind.mock.results[0].value;
    const sortResult = chain.sort.mock.results[0].value;
    expect(sortResult.limit).toHaveBeenCalledWith(5);
  });
});
