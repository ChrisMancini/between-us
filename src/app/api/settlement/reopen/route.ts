import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Settlement } from "@/lib/models/settlement";
import { MonthReadiness } from "@/lib/models/month-readiness";
import { withAuth } from "@/lib/auth-guard";
import { logActivity } from "@/lib/activity-logger";
import { handleSettlementReopen } from "@/lib/action-lifecycle";

export const POST = withAuth(async (req, session) => {
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

  await MonthReadiness.deleteOne({ month, year });

  await handleSettlementReopen(existing._id, session.user.paidByKey);

  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  await logActivity(session.user.paidByKey, "settlement_reopen", `reopened ${monthName} settlement`, {
    month,
    year,
  });

  return NextResponse.json({ ok: true });
});
