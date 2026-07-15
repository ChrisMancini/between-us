import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Settlement } from "@/lib/models/settlement";
import { withAuth } from "@/lib/auth-guard";

function parseMonthYear(req: Request): { month: number; year: number } | null {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "");
  const year = parseInt(searchParams.get("year") ?? "");

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return null;
  }

  return { month, year };
}

export const HEAD = withAuth(async (req) => {
  const params = parseMonthYear(req);
  if (!params) {
    return new NextResponse(null, { status: 400 });
  }

  await connectToDatabase();

  const settlement = await Settlement.findOne(params).lean();

  if (!settlement) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(null, { status: 200 });
});

export const GET = withAuth(async (req) => {
  const params = parseMonthYear(req);
  if (!params) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  await connectToDatabase();

  const settlement = await Settlement.findOne(params).lean();

  if (!settlement) {
    return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
