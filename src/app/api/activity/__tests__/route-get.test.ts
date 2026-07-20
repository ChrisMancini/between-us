import {
  makeSession,
  asMock,
  makeGetRequest,
  expectStatus,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/activity", () => ({
  Activity: { find: jest.fn() },
}));

import { auth } from "@/auth";
import { Activity } from "@/lib/models/activity";
import { GET } from "../route";

const mockAuth = asMock(auth);

function makeActivityDoc(overrides?: Partial<{
  _id: string;
  action: string;
  actorKey: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}>) {
  return {
    _id: "act-1",
    action: "expense_create",
    actorKey: "lauren",
    summary: "added $45.20 at Publix",
    metadata: { amount: 4520 },
    createdAt: new Date("2026-05-01T12:00:00Z"),
    ...overrides,
  };
}

function mockChain(result: unknown[]) {
  return {
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe("GET /api/activity", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/activity"));
    await expectStatus(res, 401);
  });

  it("returns partner-only activities by default", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "chris"));
    const docs = [makeActivityDoc({ actorKey: "lauren" })];
    asMock(Activity.find).mockReturnValue(mockChain(docs));

    const res = await GET(makeGetRequest("/api/activity"));
    const body = await expectStatus(res, 200);

    expect(Activity.find).toHaveBeenCalledWith(
      expect.objectContaining({ actorKey: { $ne: "chris" } })
    );
    expect(body.activities).toHaveLength(1);
    expect(body.activities[0].actorKey).toBe("lauren");
    expect(body.nextCursor).toBeNull();
  });

  it("returns all activities when filter=all", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "chris"));
    const docs = [makeActivityDoc({ actorKey: "chris" })];
    asMock(Activity.find).mockReturnValue(mockChain(docs));

    const res = await GET(
      makeGetRequest("/api/activity", { filter: "all" })
    );
    await expectStatus(res, 200);

    const findArg = asMock(Activity.find).mock.calls[0][0];
    expect(findArg.actorKey).toBeUndefined();
  });

  it("filters by action group when action is provided", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "chris"));
    asMock(Activity.find).mockReturnValue(mockChain([]));

    await GET(makeGetRequest("/api/activity", { action: "expenses" }));

    const findArg = asMock(Activity.find).mock.calls[0][0];
    expect(findArg.action).toEqual({
      $in: ["expense_create", "expense_edit", "expense_delete"],
    });
  });

  it("composes the action filter with the partner filter", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "chris"));
    asMock(Activity.find).mockReturnValue(mockChain([]));

    await GET(
      makeGetRequest("/api/activity", { action: "settlements", filter: "partner" })
    );

    const findArg = asMock(Activity.find).mock.calls[0][0];
    expect(findArg.actorKey).toEqual({ $ne: "chris" });
    expect(findArg.action).toEqual({
      $in: ["settlement_close", "settlement_reopen"],
    });
  });

  it("does not constrain action when none is provided", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "chris"));
    asMock(Activity.find).mockReturnValue(mockChain([]));

    await GET(makeGetRequest("/api/activity"));

    const findArg = asMock(Activity.find).mock.calls[0][0];
    expect(findArg.action).toBeUndefined();
  });

  it("returns 400 for an unknown action group", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "chris"));

    const res = await GET(
      makeGetRequest("/api/activity", { action: "bogus" })
    );
    await expectStatus(res, 400);
  });

  it("uses cursor for pagination", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "chris"));
    const cursor = "2026-05-01T12:00:00.000Z";
    asMock(Activity.find).mockReturnValue(mockChain([]));

    await GET(makeGetRequest("/api/activity", { cursor }));

    const findArg = asMock(Activity.find).mock.calls[0][0];
    expect(findArg.createdAt).toEqual({ $lt: new Date(cursor) });
  });

  it("returns nextCursor when more items exist", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "chris"));
    const docs = Array.from({ length: 21 }, (_, i) =>
      makeActivityDoc({
        _id: `act-${i}`,
        createdAt: new Date(Date.UTC(2026, 4, 1, 12, 0, 0) - i * 60000),
      })
    );
    asMock(Activity.find).mockReturnValue(mockChain(docs));

    const res = await GET(makeGetRequest("/api/activity"));
    const body = await expectStatus(res, 200);

    expect(body.activities).toHaveLength(20);
    expect(body.nextCursor).toBeTruthy();
  });

  it("serializes _id and createdAt correctly", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "chris"));
    const doc = makeActivityDoc({ _id: { toString: () => "abc123" } as unknown as string });
    asMock(Activity.find).mockReturnValue(mockChain([doc]));

    const res = await GET(makeGetRequest("/api/activity"));
    const body = await expectStatus(res, 200);

    expect(body.activities[0]._id).toBe("abc123");
    expect(typeof body.activities[0].createdAt).toBe("string");
  });
});
