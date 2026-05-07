import {
  makeSession,
  asMock,
  makeTemplate,
  mockChain,
  makeGetRequest,
  expectStatus,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/recurring-template", () => ({
  RecurringTemplate: { find: jest.fn() },
}));
jest.mock("@/lib/models/category", () => ({ Category: {} }));
jest.mock("@/lib/validations/recurring-template", () => ({
  recurringTemplateApiSchema: {},
}));

import { auth } from "@/auth";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { GET } from "../route";

const mockAuth = asMock(auth);

describe("GET /api/recurring", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/recurring"));
    await expectStatus(res, 401);
  });

  it("returns 200 with templates filtered by createdBy", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const template = makeTemplate();
    asMock(RecurringTemplate.find).mockReturnValue(mockChain([template]));

    const res = await GET(makeGetRequest("/api/recurring"));
    const body = await expectStatus(res, 200);
    expect(body.templates).toHaveLength(1);
    expect(body.templates[0].name).toBe("Monthly Bills");
    expect(asMock(RecurringTemplate.find)).toHaveBeenCalledWith({
      createdBy: "user-1",
    });
  });
});
