import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Action, serializeAction } from "@/lib/models/action";
import { actionQuerySchema } from "@/lib/validations/action";
import { withAuth } from "@/lib/auth-guard";

export const GET = withAuth(async (req, session) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = actionQuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { status, limit } = parsed.data;
  const userKey = session.user.paidByKey;

  await connectToDatabase();

  const filter: Record<string, unknown> = {
    $or: [{ debtorKey: userKey }, { creditorKey: userKey }],
  };

  if (status) {
    filter.status = status;
  } else {
    filter.status = { $in: ["pending", "paid"] };
  }

  const actions = await Action.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({
    actions: actions.map((a) => serializeAction(a)),
  });
});
