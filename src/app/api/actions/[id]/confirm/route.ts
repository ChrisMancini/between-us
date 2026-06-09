import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Action, serializeAction } from "@/lib/models/action";
import { withAuth } from "@/lib/auth-guard";
import { logActivity } from "@/lib/activity-logger";
import { formatCurrency } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAuth<RouteContext>(async (_req, session, context) => {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  await connectToDatabase();

  const action = await Action.findById(id);
  if (!action) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  if (action.creditorKey !== session.user.paidByKey) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (action.status === "confirmed" || action.status === "cancelled") {
    return NextResponse.json(
      { error: `Action is already ${action.status}` },
      { status: 422 }
    );
  }

  action.status = "confirmed";
  action.confirmedAt = new Date();
  await action.save();

  await logActivity(
    session.user.paidByKey,
    "action_confirmed",
    `confirmed ${formatCurrency(action.amount)} payment — ${action.description}`,
    { actionId: String(action._id) }
  );

  return NextResponse.json({ action: serializeAction(action) });
});
