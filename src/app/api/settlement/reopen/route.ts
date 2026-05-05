import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Settlement } from "@/lib/models/settlement";
import { withAuth } from "@/lib/auth-guard";

export const POST = withAuth(async (req) => {
  const body = await req.json();
  const month = parseInt(body.month);
  const year = parseInt(body.year);

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  await connectToDatabase();

  const existing = await Settlement.findOne({ month, year });

  if (!existing) {
    return NextResponse.json({ error: "No settlement found" }, { status: 404 });
  }

  if (existing.status === "open") {
    return NextResponse.json(
      { error: "Month is already open" },
      { status: 409 }
    );
  }

  // Store the current totals before reopening so the re-close dialog can show the delta
  await Settlement.findByIdAndUpdate(
    existing._id,
    {
      $set: {
        status: "open",
        previousTotalOwed: existing.totalOwed,
        previousOwedBy: existing.owedBy,
        reopenedAt: new Date(),
      },
    },
    { strict: false }
  );

  return NextResponse.json({ ok: true });
});
