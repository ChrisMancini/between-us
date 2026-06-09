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
  dashboardWidgetPreferencesSchema: { safeParse: jest.fn() },
}));

import { auth } from "@/auth";
import { UserPreference } from "@/lib/models/user-preference";
import { dashboardWidgetPreferencesSchema } from "@/lib/validations/user-preference";
import { PUT } from "../route";

const mockAuth = asMock(auth);
const mockSafeParse = asMock(dashboardWidgetPreferencesSchema.safeParse);

const WIDGETS = [
  { widgetId: "settlement-status", collapsed: false },
  { widgetId: "activity", collapsed: true },
];

function putRequest() {
  return makeJsonRequest("/api/user-preferences/dashboard", { widgets: WIDGETS }, "PUT");
}

describe("PUT /api/user-preferences/dashboard", () => {
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

  it("returns 200 on success with upsert", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john", "user-1"));
    mockSafeParse.mockReturnValue(makeParsedSuccess({ widgets: WIDGETS }));
    asMock(UserPreference.findOneAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ dashboard: { widgets: WIDGETS } }),
    });

    const res = await PUT(putRequest());
    const body = await expectStatus(res, 200);
    expect(body.widgets).toEqual(WIDGETS);
  });

  it("filters by the authenticated user's ID", async () => {
    mockAuth.mockResolvedValue(makeSession("user", "john", "user-42"));
    mockSafeParse.mockReturnValue(makeParsedSuccess({ widgets: WIDGETS }));
    asMock(UserPreference.findOneAndUpdate).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ dashboard: { widgets: WIDGETS } }),
    });

    await PUT(putRequest());

    expect(UserPreference.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-42" },
      { $set: { "dashboard.widgets": WIDGETS } },
      { upsert: true, new: true }
    );
  });
});
