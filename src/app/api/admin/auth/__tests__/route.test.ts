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
jest.mock("@/lib/models/app-settings", () => ({
  AppSettings: { findOneAndUpdate: jest.fn() },
}));
jest.mock("@/lib/models/person", () => ({
  Person: { findOne: jest.fn(), findOneAndUpdate: jest.fn() },
}));
jest.mock("@/lib/auth-providers", () => ({
  getAvailableOAuthProviders: jest.fn(),
}));

import { auth } from "@/auth";
import { AppSettings } from "@/lib/models/app-settings";
import { Person } from "@/lib/models/person";
import { getAvailableOAuthProviders } from "@/lib/auth-providers";
import { PUT } from "../route";

const mockAuth = asMock(auth);

describe("PUT /api/admin/auth", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PUT(
      makeJsonRequest("/api/admin/auth", { authMethod: "basic", oauthProvider: null }, "PUT")
    );
    await expectStatus(res, 401);
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("user"));
    const res = await PUT(
      makeJsonRequest("/api/admin/auth", { authMethod: "basic", oauthProvider: null }, "PUT")
    );
    await expectError(res, 403, "Forbidden");
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    const res = await PUT(
      makeJsonRequest("/api/admin/auth", { bad: "data" }, "PUT")
    );
    await expectError(res, 400, "Validation failed");
  });

  it("returns 400 when oauth provider is not configured", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(getAvailableOAuthProviders).mockReturnValue([]);
    const res = await PUT(
      makeJsonRequest(
        "/api/admin/auth",
        { authMethod: "oauth", oauthProvider: "google" },
        "PUT"
      )
    );
    await expectError(res, 400, "not configured");
  });

  it("returns 200 for basic auth update", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(AppSettings.findOneAndUpdate).mockResolvedValue({});

    const res = await PUT(
      makeJsonRequest(
        "/api/admin/auth",
        { authMethod: "basic", oauthProvider: null },
        "PUT"
      )
    );
    const body = await expectStatus(res, 200);
    expect(body.ok).toBe(true);
  });

  it("returns 200 for oauth update with persons", async () => {
    mockAuth.mockResolvedValue(makeAdminSession());
    asMock(getAvailableOAuthProviders).mockReturnValue([{ key: "google" }]);
    asMock(Person.findOne).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ emails: {} }),
    });
    asMock(Person.findOneAndUpdate).mockResolvedValue({});
    asMock(AppSettings.findOneAndUpdate).mockResolvedValue({});

    const res = await PUT(
      makeJsonRequest(
        "/api/admin/auth",
        {
          authMethod: "oauth",
          oauthProvider: "google",
          persons: [
            { personKey: "john", emails: { google: "john@test.com" } },
            { personKey: "jane", emails: { google: "jane@test.com" } },
          ],
        },
        "PUT"
      )
    );
    const body = await expectStatus(res, 200);
    expect(body.ok).toBe(true);
  });
});
