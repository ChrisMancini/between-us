import {
  makeSession,
  asMock,
  makeJsonRequest,
  makeParsedSuccess,
  makeParsedFailure,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/user-preference", () => ({
  UserPreference: { findOneAndUpdate: jest.fn() },
}));
jest.mock("@/lib/validations/user-preference", () => ({
  themePreferenceSchema: { safeParse: jest.fn() },
}));

import { auth } from "@/auth";
import { UserPreference } from "@/lib/models/user-preference";
import { themePreferenceSchema } from "@/lib/validations/user-preference";
import { PUT } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(themePreferenceSchema.safeParse);

function putRequest(theme = "dark") {
  return makeJsonRequest("/api/user-preferences/theme", { theme }, "PUT");
}

describe("PUT /api/user-preferences/theme", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PUT(putRequest());
    await expectStatus(res, 401);
  });

  it("returns 400 when validation fails", async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockSafeParse.mockReturnValue(makeParsedFailure());
    const res = await PUT(putRequest());
    await expectError(res, 400, "Validation failed");
  });

  it("returns 200 on success with upserted theme", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john", "user-1"));
    mockSafeParse.mockReturnValue(makeParsedSuccess({ theme: "dark" }));
    asMock(UserPreference.findOneAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ theme: "dark" }),
    });

    const res = await PUT(putRequest("dark"));
    const body = await expectStatus(res, 200);
    expect(body.theme).toBe("dark");
  });

  it("filters by the authenticated user's ID", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john", "user-42"));
    mockSafeParse.mockReturnValue(makeParsedSuccess({ theme: "light" }));
    asMock(UserPreference.findOneAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ theme: "light" }),
    });

    await PUT(putRequest("light"));

    expect(UserPreference.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-42" },
      { $set: { theme: "light" } },
      { upsert: true, returnDocument: "after" }
    );
  });
});
