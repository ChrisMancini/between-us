import {
  asMock,
  makeJsonRequest,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/person", () => ({
  Person: { countDocuments: jest.fn(), create: jest.fn() },
}));
jest.mock("@/lib/models/category", () => ({
  Category: { countDocuments: jest.fn(), insertMany: jest.fn() },
}));
jest.mock("@/lib/models/app-settings", () => ({
  AppSettings: { findOneAndUpdate: jest.fn() },
}));
jest.mock("@/lib/auth-providers", () => ({
  getAvailableOAuthProviders: jest.fn(),
}));

import { Person } from "@/lib/models/person";
import { Category } from "@/lib/models/category";
import { AppSettings } from "@/lib/models/app-settings";
import { getAvailableOAuthProviders } from "@/lib/auth-providers";
import { POST } from "../route";

const validBasicSetup = {
  authMethod: "basic" as const,
  oauthProvider: null,
  persons: [
    { key: "john", displayName: "John", role: "admin" as const },
    { key: "jane", displayName: "Jane", role: "user" as const },
  ],
};

describe("POST /api/setup", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when validation fails", async () => {
    const res = await POST(makeJsonRequest("/api/setup", { bad: "data" }));
    await expectError(res, 400, "Validation failed");
  });

  it("returns 409 when setup already completed", async () => {
    asMock(Person.countDocuments).mockResolvedValue(2);
    const res = await POST(makeJsonRequest("/api/setup", validBasicSetup));
    await expectError(res, 409, "Setup already completed");
  });

  it("returns 400 when oauth provider is not configured", async () => {
    asMock(Person.countDocuments).mockResolvedValue(0);
    asMock(getAvailableOAuthProviders).mockReturnValue([]);
    const res = await POST(
      makeJsonRequest("/api/setup", {
        authMethod: "oauth",
        oauthProvider: "google",
        persons: [
          {
            key: "john",
            displayName: "John",
            role: "admin",
            emails: { google: "john@test.com" },
          },
          {
            key: "jane",
            displayName: "Jane",
            role: "user",
            emails: { google: "jane@test.com" },
          },
        ],
      })
    );
    await expectError(res, 400, "not configured");
  });

  it("returns 201 for basic setup", async () => {
    asMock(Person.countDocuments).mockResolvedValue(0);
    asMock(Person.create).mockResolvedValue([]);
    asMock(AppSettings.findOneAndUpdate).mockResolvedValue({});
    asMock(Category.countDocuments).mockResolvedValue(0);
    asMock(Category.insertMany).mockResolvedValue([]);

    const res = await POST(makeJsonRequest("/api/setup", validBasicSetup));
    const body = await expectStatus(res, 201);
    expect(body.ok).toBe(true);
  });

  it("returns 201 for oauth setup", async () => {
    asMock(Person.countDocuments).mockResolvedValue(0);
    asMock(getAvailableOAuthProviders).mockReturnValue([{ key: "google" }]);
    asMock(Person.create).mockResolvedValue([]);
    asMock(AppSettings.findOneAndUpdate).mockResolvedValue({});
    asMock(Category.countDocuments).mockResolvedValue(5);

    const res = await POST(
      makeJsonRequest("/api/setup", {
        authMethod: "oauth",
        oauthProvider: "google",
        persons: [
          {
            key: "john",
            displayName: "John",
            role: "admin",
            emails: { google: "john@test.com" },
          },
          {
            key: "jane",
            displayName: "Jane",
            role: "user",
            emails: { google: "jane@test.com" },
          },
        ],
      })
    );
    const body = await expectStatus(res, 201);
    expect(body.ok).toBe(true);
    expect(asMock(Category.insertMany)).not.toHaveBeenCalled();
  });
});
