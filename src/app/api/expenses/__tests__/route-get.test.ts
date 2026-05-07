import {
  makeSession,
  asMock,
  makeExpense,
  mockChain,
  makeGetRequest,
  expectStatus,
} from "@/test/api-helpers";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/expense", () => ({
  Expense: { find: jest.fn() },
}));
jest.mock("@/lib/models/category", () => ({ Category: {} }));
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

  it("filters out expenses with null category", async () => {
    mockAuth.mockResolvedValue(makeSession());
    const good = makeExpense();
    const bad = makeExpense({ category: null as unknown as undefined });
    asMock(Expense.find).mockReturnValue(mockChain([good, bad]));

    const res = await GET(makeGetRequest("/api/expenses"));
    const body = await expectStatus(res, 200);
    expect(body.expenses).toHaveLength(1);
  });

  it("returns 200 with empty array when no expenses", async () => {
    mockAuth.mockResolvedValue(makeSession());
    asMock(Expense.find).mockReturnValue(mockChain([]));

    const res = await GET(makeGetRequest("/api/expenses"));
    const body = await expectStatus(res, 200);
    expect(body.expenses).toEqual([]);
  });
});
