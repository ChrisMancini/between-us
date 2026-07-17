import {
  makeSession,
  makeAdminSession,
  asMock,
  makeJsonRequest,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/recurring-runner", () => ({ runScheduler: jest.fn() }));

import { auth } from "@/auth";
import { runScheduler } from "@/lib/recurring-runner";
import { POST } from "../route";

const mockAuth = asMock(auth);

describe("POST /api/admin/recurring/run", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/admin/recurring/run", {}));
    await expectStatus(res, 401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("user"));
    const res = await POST(makeJsonRequest("/api/admin/recurring/run", {}));
    await expectError(res, 403, "Forbidden");
    expect(runScheduler).not.toHaveBeenCalled();
  });

  it("runs the scheduler and returns its result for an admin", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(runScheduler).mockResolvedValue({
      templatesProcessed: 1,
      occurrencesApplied: 2,
      occurrencesSkipped: 0,
      expensesCreated: 3,
    });

    const res = await POST(makeJsonRequest("/api/admin/recurring/run", {}));
    const body = await expectStatus(res, 200);

    expect(runScheduler).toHaveBeenCalledWith(expect.any(Date));
    expect(body).toMatchObject({ occurrencesApplied: 2, expensesCreated: 3 });
  });
});
