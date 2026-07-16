jest.mock("@/lib/action-lifecycle", () => ({
  handleExpenseChange: jest.fn().mockResolvedValue(undefined),
  handleExpenseDelete: jest.fn().mockResolvedValue(undefined),
  getOtherPersonKey: jest.fn().mockResolvedValue("jane"),
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/lib/models/expense", () => ({
  Expense: { findById: jest.fn() },
}));
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

import {
  makeSession,
  asMock,
  makeIdContext,
  makeGetRequest,
  makeExpense,
  VALID_ID,
  VALID_ID_2,
  expectStatus,
} from "@/test/api-helpers";
import { auth } from "@/auth";
import { Expense } from "@/lib/models/expense";
import { GET } from "../route";

const mockAuth = asMock(auth);
const mockFindById = asMock(Expense.findById);

describe("GET /api/expenses/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(makeSession());
  });

  it("returns expense when found", async () => {
    const expense = makeExpense({
      _id: VALID_ID,
      where: "Whole Foods",
      amount: 5000,
      notes: "Weekly shopping",
    });

    const mockPopulate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(expense),
    });
    mockFindById.mockReturnValue({ populate: mockPopulate } as unknown);

    const response = await GET(makeGetRequest("/api/expenses/" + VALID_ID), makeIdContext(VALID_ID));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.expense).toMatchObject({
      _id: VALID_ID,
      where: "Whole Foods",
      amount: 5000,
      notes: "Weekly shopping",
    });
  });

  it("returns 404 when expense not found", async () => {
    const mockPopulate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    mockFindById.mockReturnValue({ populate: mockPopulate } as unknown);

    const response = await GET(makeGetRequest("/api/expenses/" + VALID_ID), makeIdContext(VALID_ID));

    expectStatus(response, 404);
  });

  it("returns 400 for invalid ID format", async () => {
    const response = await GET(makeGetRequest("/api/expenses/invalid-id"), makeIdContext("invalid-id"));

    expectStatus(response, 400);
  });

  it("populates tags on the expense", async () => {
    const expense = makeExpense({
      _id: VALID_ID,
      tags: [{ _id: VALID_ID_2, path: "Groceries", sortOrder: 1 }] as unknown[],
    });

    const mockPopulate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(expense),
    });
    mockFindById.mockReturnValue({ populate: mockPopulate } as unknown);

    const response = await GET(makeGetRequest("/api/expenses/" + VALID_ID), makeIdContext(VALID_ID));

    expect(response.status).toBe(200);
    expect(mockPopulate).toHaveBeenCalledWith("tags");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await GET(makeGetRequest("/api/expenses/" + VALID_ID), makeIdContext(VALID_ID));

    expectStatus(response, 401);
  });

  it("allows partner to view expense", async () => {
    const expense = makeExpense({
      _id: VALID_ID,
      paidBy: "jane",
      where: "Gas Station",
      amount: 4500,
    });

    const mockPopulate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(expense),
    });
    mockFindById.mockReturnValue({ populate: mockPopulate } as unknown);

    mockAuth.mockResolvedValue(makeSession("user", "john"));
    const response = await GET(makeGetRequest("/api/expenses/" + VALID_ID), makeIdContext(VALID_ID));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.expense.paidBy).toBe("jane");
  });

  it("allows owner to view own expense", async () => {
    const expense = makeExpense({
      _id: VALID_ID,
      paidBy: "john",
      where: "Grocery Store",
      amount: 6700,
    });

    const mockPopulate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(expense),
    });
    mockFindById.mockReturnValue({ populate: mockPopulate } as unknown);

    mockAuth.mockResolvedValue(makeSession("user", "john"));
    const response = await GET(makeGetRequest("/api/expenses/" + VALID_ID), makeIdContext(VALID_ID));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.expense.paidBy).toBe("john");
  });
});
