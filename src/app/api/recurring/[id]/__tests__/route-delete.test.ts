import {
  makeSession,
  asMock,
  makeRequest,
  makeIdContext,
  VALID_ID,
  expectStatus,
  expectError,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/recurring-template", () => ({
  RecurringTemplate: {
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));
jest.mock("@/lib/models/category", () => ({ Category: {} }));
jest.mock("@/lib/validations/recurring-template", () => ({
  recurringTemplateApiSchema: {},
}));

import { auth } from "@/auth";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { DELETE } from "../route";

const mockAuth = asMock(auth);

function deleteRequest() {
  return makeRequest(`/api/recurring/${VALID_ID}`, { method: "DELETE" });
}

describe("DELETE /api/recurring/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectStatus(res, 401);
  });

  it("returns 400 for invalid ObjectId", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const res = await DELETE(deleteRequest(), makeIdContext("not-an-id"));
    await expectError(res, 400, "Invalid ID");
  });

  it("returns 404 when template not found", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(RecurringTemplate.findOneAndDelete).mockResolvedValue(null);
    const res = await DELETE(deleteRequest(), makeIdContext());
    await expectError(res, 404, "Template not found");
  });

  it("returns 200 on success", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(RecurringTemplate.findOneAndDelete).mockResolvedValue({
      _id: VALID_ID,
    });
    const res = await DELETE(deleteRequest(), makeIdContext());
    const body = await expectStatus(res, 200);
    expect(body.ok).toBe(true);
  });
});
