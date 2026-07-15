import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Settlement } from "@/lib/models/settlement";
import { withAuth } from "@/lib/auth-guard";
import type { ISettlement, SerializedSettlement } from "@/lib/models/settlement";
import { fetchMonthBreakdown, closeMonth } from "./_helpers/close-month";

function serializeSettlement(doc: ISettlement): SerializedSettlement {
  return {
    _id: doc._id.toString(),
    month: doc.month,
    year: doc.year,
    status: doc.status ?? "closed",
    totalOwed: doc.totalOwed,
    owedBy: doc.owedBy,
    owedTo: doc.owedTo,
    closedAt: doc.closedAt.toISOString(),
    note: doc.note,
    person1OwesPerson2: doc.person1OwesPerson2,
    person2OwesPerson1: doc.person2OwesPerson1,
    previousTotalOwed: doc.previousTotalOwed,
    previousOwedBy: doc.previousOwedBy,
    reopenedAt: doc.reopenedAt?.toISOString(),
  };
}

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "");
  const year = parseInt(searchParams.get("year") ?? "");

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await Settlement.findOne({ month, year }).lean();

  if (existing && existing.status !== "open") {
    return NextResponse.json({
      status: "closed",
      settlement: serializeSettlement(existing as ISettlement),
    });
  }

  const { breakdown } = await fetchMonthBreakdown(month, year);

  return NextResponse.json({
    status: "open",
    breakdown,
    previousSettlement: existing
      ? {
          totalOwed: existing.totalOwed,
          owedBy: existing.owedBy,
          note: existing.note,
        }
      : null,
  });
});

export const POST = withAuth(async (req, session) => {
  const body = await req.json();
  const month = parseInt(body.month);
  const year = parseInt(body.year);
  const note = typeof body.note === "string" ? body.note.trim() || undefined : undefined;

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await Settlement.findOne({ month, year });

  if (existing && existing.status !== "open") {
    return NextResponse.json(
      { error: "Month already closed" },
      { status: 409 },
    );
  }

  const { settlement, isNew } = await closeMonth(month, year, note, session.user.paidByKey, existing?._id?.toString());

  return NextResponse.json(
    { settlement: serializeSettlement(settlement) },
    { status: isNew ? 201 : 200 },
  );
});

export const PATCH = withAuth(async (req) => {
  const body = await req.json();
  const month = parseInt(body.month);
  const year = parseInt(body.year);

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  if (typeof body.note !== "string") {
    return NextResponse.json({ error: "Note is required" }, { status: 400 });
  }

  const trimmed = body.note.trim();

  await connectToDatabase();

  const existing = await Settlement.findOne({ month, year });

  if (!existing) {
    return NextResponse.json({ error: "No settlement found" }, { status: 404 });
  }

  const update = trimmed
    ? { $set: { note: trimmed } }
    : { $unset: { note: 1 } };

  const updated = await Settlement.findByIdAndUpdate(
    existing._id,
    update,
    { returnDocument: "after" },
  );

  return NextResponse.json({
    settlement: serializeSettlement(updated!),
  });
});
