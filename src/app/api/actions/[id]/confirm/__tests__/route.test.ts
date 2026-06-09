import {
  makeSession,
  asMock,
  makeJsonRequest,
  makeIdContext,
  expectStatus,
  expectError,
  VALID_ID,
  INVALID_ID,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/action", () => ({
  Action: { findById: jest.fn() },
  serializeAction: (doc: Record<string, unknown>) => ({
    _id: String(doc._id),
    status: doc.status,
  }),
}));
jest.mock("@/lib/activity-logger", () => ({ logActivity: jest.fn() }));

import { auth } from "@/auth";
import { Action } from "@/lib/models/action";
import { logActivity } from "@/lib/activity-logger";
import { POST } from "../route";

const mockAuth = asMock(auth);
const mockFindById = asMock(Action.findById);

function makeAction(overrides?: Record<string, unknown>) {
  return {
    _id: VALID_ID,
    debtorKey: "john",
    creditorKey: "jane",
    amount: 2500,
    status: "paid",
    description: "at Publix",
    confirmedAt: undefined as Date | undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("POST /api/actions/:id/confirm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/confirm`, {}),
      makeIdContext()
    );
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid ID", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await POST(
      makeJsonRequest(`/api/actions/${INVALID_ID}/confirm`, {}),
      makeIdContext(INVALID_ID)
    );
    await expectError(res, 400, "Invalid ID");
  });

  it("returns 404 when action not found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFindById.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/confirm`, {}),
      makeIdContext()
    );
    await expectError(res, 404, "not found");
  });

  it("returns 403 when user is not the creditor", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john"));
    mockFindById.mockResolvedValue(makeAction());
    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/confirm`, {}),
      makeIdContext()
    );
    await expectError(res, 403, "Forbidden");
  });

  it("returns 422 when action is already confirmed", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "jane"));
    mockFindById.mockResolvedValue(makeAction({ status: "confirmed" }));
    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/confirm`, {}),
      makeIdContext()
    );
    await expectError(res, 422, "already confirmed");
  });

  it("returns 422 when action is cancelled", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "jane"));
    mockFindById.mockResolvedValue(makeAction({ status: "cancelled" }));
    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/confirm`, {}),
      makeIdContext()
    );
    await expectError(res, 422, "already cancelled");
  });

  it("confirms a paid action", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "jane"));
    const action = makeAction({ status: "paid" });
    mockFindById.mockResolvedValue(action);

    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/confirm`, {}),
      makeIdContext()
    );
    const body = await expectStatus(res, 200);

    expect(action.status).toBe("confirmed");
    expect(action.confirmedAt).toBeDefined();
    expect(action.save).toHaveBeenCalled();
    expect(body.action.status).toBe("confirmed");
    expect(logActivity).toHaveBeenCalledWith(
      "jane",
      "action_confirmed",
      expect.stringContaining("$25.00"),
      expect.objectContaining({ actionId: VALID_ID })
    );
  });

  it("allows skip-to-confirm from pending status", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "jane"));
    const action = makeAction({ status: "pending" });
    mockFindById.mockResolvedValue(action);

    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/confirm`, {}),
      makeIdContext()
    );
    await expectStatus(res, 200);

    expect(action.status).toBe("confirmed");
    expect(action.confirmedAt).toBeDefined();
  });
});
