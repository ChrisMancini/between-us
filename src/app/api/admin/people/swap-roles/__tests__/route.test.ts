import {
  makeSession,
  makeAdminSession,
  asMock,
  makeJsonRequest,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/person", () => ({
  Person: { find: jest.fn(), bulkWrite: jest.fn() },
}));

import { auth } from "@/auth";
import { Person } from "@/lib/models/person";
import { POST } from "../route";

const mockAuth = asMock(auth);

describe("POST /api/admin/people/swap-roles", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeJsonRequest("/api/admin/people/swap-roles", {}));
    await expectStatus(res, 401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("user"));
    const res = await POST(makeJsonRequest("/api/admin/people/swap-roles", {}));
    await expectError(res, 403, "Forbidden");
  });

  it("returns 422 when not exactly 2 people", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(Person.find).mockResolvedValue([{ _id: "a", role: "admin" }]);
    const res = await POST(makeJsonRequest("/api/admin/people/swap-roles", {}));
    await expectError(res, 422, "Expected exactly 2 people");
  });

  it("returns 200 and swaps roles", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(Person.find).mockResolvedValue([
      { _id: "a", role: "admin" },
      { _id: "b", role: "user" },
    ]);
    asMock(Person.bulkWrite).mockResolvedValue({});

    const res = await POST(makeJsonRequest("/api/admin/people/swap-roles", {}));
    const body = await expectStatus(res, 200);
    expect(body.ok).toBe(true);
    expect(asMock(Person.bulkWrite)).toHaveBeenCalledWith([
      { updateOne: { filter: { _id: "a" }, update: { role: "user" } } },
      { updateOne: { filter: { _id: "b" }, update: { role: "admin" } } },
    ]);
  });
});
