import { NextRequest } from "next/server";
import type { Session } from "next-auth";

// --- Constants ---

export const VALID_ID = "507f1f77bcf86cd799439011";
export const VALID_ID_2 = "507f1f77bcf86cd799439022";
export const INVALID_ID = "not-an-id";

// --- Session Helpers ---

export function makeSession(
  role: "admin" | "user" = "user",
  paidByKey = "john",
  userId = "user-1"
): Session {
  return {
    user: { id: userId, role, paidByKey, name: "Test" },
    expires: "2099-01-01",
  } as Session;
}

export function makeAdminSession(paidByKey = "john"): Session {
  return makeSession("admin", paidByKey);
}

// --- Request Helpers ---

export function makeRequest(
  path: string,
  options?: { method?: string; body?: unknown; searchParams?: Record<string, string> }
): NextRequest {
  const url = new URL(path, "http://localhost");
  if (options?.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  const init: { method: string; body?: string; headers?: Record<string, string> } = { method: options?.method ?? "GET" };
  if (options?.body !== undefined) {
    init.method = options.method ?? "POST";
    init.body = JSON.stringify(options.body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(url, init);
}

export function makeGetRequest(path: string, searchParams?: Record<string, string>): NextRequest {
  return makeRequest(path, { method: "GET", searchParams });
}

export function makeJsonRequest(path: string, body: unknown, method = "POST"): NextRequest {
  return makeRequest(path, { method, body });
}

// --- Context Helpers ---

export function makeIdContext(id = VALID_ID) {
  return { params: Promise.resolve({ id }) };
}

// --- Mock Helpers ---

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function asMock(fn: Function): jest.Mock {
  return fn as unknown as jest.Mock;
}

export function makeParsedSuccess(data: unknown) {
  return { success: true as const, data };
}

export function makeParsedFailure() {
  return { success: false as const, error: { issues: [{ message: "Invalid" }] } };
}

export function mockChain(result: unknown) {
  return {
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(result),
      limit: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(result),
        }),
      }),
    }),
    lean: jest.fn().mockResolvedValue(result),
    populate: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(result),
    }),
  };
}

// --- Data Factories ---

export function makeExpense(overrides?: Partial<{
  _id: string;
  paidBy: string;
  date: Date;
  amount: number;
  where: string;
  notes: string;
  splitType: string;
  settlementType: string;
  tags: unknown[];
  createdAt: Date;
  updatedAt: Date;
}>) {
  const now = new Date();
  return {
    _id: VALID_ID,
    paidBy: "john",
    date: new Date(Date.UTC(2026, 3, 15)),
    amount: 5000,
    where: "Publix",
    notes: "Groceries",
    splitType: "split",
    settlementType: "deferred",
    tags: [
      {
        _id: VALID_ID_2,
        path: "Groceries",
        sortOrder: 2,
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeSettlement(overrides?: Partial<{
  _id: string;
  month: number;
  year: number;
  status: string;
  totalOwed: number;
  owedBy: string;
  owedTo: string;
  closedAt: Date;
  note: string;
  previousTotalOwed: number;
  previousOwedBy: string;
  reopenedAt: Date;
}>) {
  return {
    _id: VALID_ID,
    month: 4,
    year: 2026,
    status: "closed",
    totalOwed: 10000,
    owedBy: "john",
    owedTo: "jane",
    closedAt: new Date(),
    ...overrides,
  };
}

export function makeTemplate(overrides?: Partial<{
  _id: string;
  name: string;
  createdBy: string;
  items: unknown[];
  createdAt: Date;
  updatedAt: Date;
}>) {
  const now = new Date();
  return {
    _id: VALID_ID,
    name: "Monthly Bills",
    createdBy: "user-1",
    items: [
      {
        paidBy: "john",
        tagIds: [VALID_ID_2],
        amount: 10000,
        where: "FPL",
        notes: "Electric",
        splitType: "split",
        settlementType: "deferred",
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeCsvFormat(overrides?: Partial<{
  _id: string;
  name: string;
}>) {
  return {
    _id: VALID_ID,
    name: "Chase",
    dateColumn: "Transaction Date",
    dateFormat: "MM/DD/YYYY",
    descriptionColumn: "Description",
    amountType: "single",
    amountColumn: "Amount",
    purchaseSign: "positive",
    tagMappings: [],
    ...overrides,
  };
}

export function makeReadiness(overrides?: Partial<{
  month: number;
  year: number;
  doneBy: string[];
}>) {
  return {
    month: 4,
    year: 2026,
    doneBy: [],
    ...overrides,
  };
}

// --- Assertion Helpers ---

export async function expectStatus(res: Response, status: number) {
  expect(res.status).toBe(status);
  return res.json();
}

export async function expectError(res: Response, status: number, errorSubstring?: string) {
  expect(res.status).toBe(status);
  const body = await res.json();
  if (errorSubstring) {
    expect(body.error).toContain(errorSubstring);
  }
  return body;
}
