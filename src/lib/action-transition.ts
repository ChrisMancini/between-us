import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Action, serializeAction, type IAction } from "@/lib/models/action";
import type { ActivityAction } from "@/lib/models/activity";
import { withAuth } from "@/lib/auth-guard";
import { logActivity } from "@/lib/activity-logger";
import { invalidId } from "@/lib/api-utils";

interface ActionTransition {
  authorizeField: "creditorKey" | "debtorKey";
  guardStatus: (status: string) => string | null;
  newStatus: string;
  timestampField: "confirmedAt" | "paidAt";
  activityType: ActivityAction;
  activityMessage: (action: IAction) => string;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export function actionTransitionRoute(transition: ActionTransition) {
  return withAuth<RouteContext>(async (_req, session, context) => {
    const { id } = await context.params;
    const err = invalidId(id);
    if (err) return err;

    await connectToDatabase();

    const action = await Action.findById(id);
    if (!action) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    if (action[transition.authorizeField] !== session.user.paidByKey) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const statusError = transition.guardStatus(action.status);
    if (statusError) {
      return NextResponse.json({ error: statusError }, { status: 422 });
    }

    action.status = transition.newStatus;
    action[transition.timestampField] = new Date();
    await action.save();

    await logActivity(
      session.user.paidByKey,
      transition.activityType,
      transition.activityMessage(action),
      { actionId: String(action._id) },
    );

    return NextResponse.json({ action: serializeAction(action) });
  });
}
