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
    status: "pending",
    description: "at Publix",
    paidAt: undefined as Date | undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("POST /api/actions/:id/pay", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/pay`, {}),
      makeIdContext()
    );
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid ID", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await POST(
      makeJsonRequest(`/api/actions/${INVALID_ID}/pay`, {}),
      makeIdContext(INVALID_ID)
    );
    await expectError(res, 400, "Invalid ID");
  });

  it("returns 404 when action not found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFindById.mockResolvedValue(null);
    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/pay`, {}),
      makeIdContext()
    );
    await expectError(res, 404, "not found");
  });

  it("returns 403 when user is not the debtor", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "jane"));
    mockFindById.mockResolvedValue(makeAction());
    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/pay`, {}),
      makeIdContext()
    );
    await expectError(res, 403, "Forbidden");
  });

  it("returns 422 when action is not pending", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockFindById.mockResolvedValue(makeAction({ status: "paid" }));
    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/pay`, {}),
      makeIdContext()
    );
    await expectError(res, 422, "not pending");
  });

  it("marks action as paid and logs activity", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const action = makeAction();
    mockFindById.mockResolvedValue(action);

    const res = await POST(
      makeJsonRequest(`/api/actions/${VALID_ID}/pay`, {}),
      makeIdContext()
    );
    const body = await expectStatus(res, 200);

    expect(action.status).toBe("paid");
    expect(action.paidAt).toBeDefined();
    expect(action.save).toHaveBeenCalled();
    expect(body.action.status).toBe("paid");
    expect(logActivity).toHaveBeenCalledWith(
      "john",
      "action_paid",
      expect.stringContaining("$25.00"),
      expect.objectContaining({ actionId: VALID_ID })
    );
  });
});
