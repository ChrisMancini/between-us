import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Settlement } from "@/lib/models/settlement";
import { MonthReadiness } from "@/lib/models/month-readiness";
import { withAuth } from "@/lib/auth-guard";
import { logActivity } from "@/lib/activity-logger";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "");
  const year = parseInt(searchParams.get("year") ?? "");

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  await connectToDatabase();

  const doc = await MonthReadiness.findOne({ month, year }).lean();

  return NextResponse.json({ doneBy: doc?.doneBy ?? [] });
});

export const POST = withAuth(async (req, session) => {
  const body = await req.json();
  const month = parseInt(body.month);
  const year = parseInt(body.year);

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  await connectToDatabase();

  const closed = await Settlement.findOne({
    month,
    year,
    status: { $ne: "open" },
  }).lean();

  if (closed) {
    return NextResponse.json({ error: "Month is closed" }, { status: 409 });
  }

  const personKey = session.user.paidByKey;
  const existing = await MonthReadiness.findOne({ month, year });
  const isDone = existing?.doneBy?.includes(personKey) ?? false;

  let updated;
  if (isDone) {
    updated = await MonthReadiness.findOneAndUpdate(
      { month, year },
      { $pull: { doneBy: personKey } },
      { new: true }
    );
  } else {
    updated = await MonthReadiness.findOneAndUpdate(
      { month, year },
      { $addToSet: { doneBy: personKey } },
      { new: true, upsert: true }
    );
  }

  const toggled = isDone ? "undone" : "done";
  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  await logActivity(
    personKey,
    isDone ? "expenses_undone" : "expenses_done",
    isDone ? `unmarked ${monthName}` : `marked ${monthName} as done`,
    { month, year }
  );

  return NextResponse.json({
    doneBy: updated?.doneBy ?? [],
    toggled,
  });
});
