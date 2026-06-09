import {
  makeSession,
  asMock,
  makeExpense,
  mockChain,
  makeGetRequest,
  expectStatus,
} from "@/test/api-helpers";

jest.mock("@/lib/action-lifecycle", () => ({
  createActionForExpense: jest.fn().mockResolvedValue(null),
  getOtherPersonKey: jest.fn().mockResolvedValue("jane"),
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/expense", () => ({
  Expense: { find: jest.fn() },
}));
jest.mock("@/lib/models/tag", () => ({ Tag: {} }));
jest.mock("@/lib/tag-utils", () => ({
  serializeTag: (t: { _id: unknown; path: string; sortOrder: number }) => ({
    _id: String(t._id),
    path: t.path,
    sortOrder: t.sortOrder,
    name: t.path.split("/").pop(),
    parent: "",
    depth: 1,
  }),
}));
jest.mock("@/lib/validations/expense", () => ({ expenseApiSchema: {} }));
jest.mock("@/lib/settlement-guard", () => ({ assertMonthsOpen: jest.fn() }));

import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { GET } from "../route";

const mockAuth = asMock(auth);

describe("GET /api/expenses", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/expenses"));
    await expectStatus(res, 401);
  });

  it("returns 200 with expenses", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const expense = makeExpense();
    asMock(Expense.find).mockReturnValue(mockChain([expense]));

    const res = await GET(makeGetRequest("/api/expenses"));
    const body = await expectStatus(res, 200);
    expect(body.expenses).toHaveLength(1);
    expect(body.expenses[0].where).toBe("Publix");
  });

  it("returns expenses with empty tags", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const good = makeExpense();
    const noTags = makeExpense({ tags: [] });
    asMock(Expense.find).mockReturnValue(mockChain([good, noTags]));

    const res = await GET(makeGetRequest("/api/expenses"));
    const body = await expectStatus(res, 200);
    expect(body.expenses).toHaveLength(2);
  });

  it("returns 200 with empty array when no expenses", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Expense.find).mockReturnValue(mockChain([]));

    const res = await GET(makeGetRequest("/api/expenses"));
    const body = await expectStatus(res, 200);
    expect(body.expenses).toEqual([]);
  });
});
