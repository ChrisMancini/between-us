import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/auth";
import { withAuth, withAdmin } from "@/lib/auth-guard";

const mockAuth = auth as jest.MockedFunction<typeof auth>;

function makeSession(role: "admin" | "user" = "user"): Session {
  return {
    user: { id: "user-1", role, name: "Test" },
    expires: "2099-01-01",
  } as Session;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/test");
}

describe("withAuth", () => {
  beforeEach(() => {
    mockAuth.mockReset();
  });

  it("returns 401 when no session exists", async () => {
    mockAuth.mockResolvedValue(null);
    const handler = jest.fn();
    const wrapped = withAuth(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler with req and session when authenticated", async () => {
    const session = makeSession();
    mockAuth.mockResolvedValue(session);
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth(handler);
    const req = makeRequest();
    const res = await wrapped(req);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(req, session);
  });

  it("passes context as third argument when provided", async () => {
    const session = makeSession();
    mockAuth.mockResolvedValue(session);
    const context = { params: Promise.resolve({ id: "123" }) };
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAuth<typeof context>(handler);
    const req = makeRequest();
    await wrapped(req, context);
    expect(handler).toHaveBeenCalledWith(req, session, context);
  });
});

describe("withAdmin", () => {
  beforeEach(() => {
    mockAuth.mockReset();
  });

  it("returns 401 when no session exists", async () => {
    mockAuth.mockResolvedValue(null);
    const handler = jest.fn();
    const wrapped = withAdmin(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue(makeSession("user"));
    const handler = jest.fn();
    const wrapped = withAdmin(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when user is admin", async () => {
    const session = makeSession("admin");
    mockAuth.mockResolvedValue(session);
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAdmin(handler);
    const req = makeRequest();
    const res = await wrapped(req);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(req, session);
  });

  it("passes context as third argument when provided", async () => {
    const session = makeSession("admin");
    mockAuth.mockResolvedValue(session);
    const context = { params: Promise.resolve({ id: "456" }) };
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withAdmin<typeof context>(handler);
    const req = makeRequest();
    await wrapped(req, context);
    expect(handler).toHaveBeenCalledWith(req, session, context);
  });
});
