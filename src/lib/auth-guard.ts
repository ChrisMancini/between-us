import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";

export function withAuth(
  handler: (req: NextRequest, session: Session) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse>;

export function withAuth<TContext>(
  handler: (
    req: NextRequest,
    session: Session,
    context: TContext
  ) => Promise<NextResponse>
): (req: NextRequest, context: TContext) => Promise<NextResponse>;

export function withAuth<TContext>(
  handler:
    | ((req: NextRequest, session: Session) => Promise<NextResponse>)
    | ((
        req: NextRequest,
        session: Session,
        context: TContext
      ) => Promise<NextResponse>)
) {
  return async (req: NextRequest, context?: TContext): Promise<NextResponse> => {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (context !== undefined) {
      return (
        handler as (
          req: NextRequest,
          session: Session,
          context: TContext
        ) => Promise<NextResponse>
      )(req, session, context);
    }
    return (handler as (req: NextRequest, session: Session) => Promise<NextResponse>)(
      req,
      session
    );
  };
}

export function withAdmin(
  handler: (req: NextRequest, session: Session) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse>;

export function withAdmin<TContext>(
  handler: (
    req: NextRequest,
    session: Session,
    context: TContext
  ) => Promise<NextResponse>
): (req: NextRequest, context: TContext) => Promise<NextResponse>;

export function withAdmin<TContext>(
  handler:
    | ((req: NextRequest, session: Session) => Promise<NextResponse>)
    | ((
        req: NextRequest,
        session: Session,
        context: TContext
      ) => Promise<NextResponse>)
) {
  return async (req: NextRequest, context?: TContext): Promise<NextResponse> => {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (context !== undefined) {
      return (
        handler as (
          req: NextRequest,
          session: Session,
          context: TContext
        ) => Promise<NextResponse>
      )(req, session, context);
    }
    return (handler as (req: NextRequest, session: Session) => Promise<NextResponse>)(
      req,
      session
    );
  };
}
