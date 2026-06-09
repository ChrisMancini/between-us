import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Action } from "@/lib/models/action";
import { withAuth } from "@/lib/auth-guard";

export const GET = withAuth(async (_req, session) => {
  const userKey = session.user.paidByKey;

  await connectToDatabase();

  const count = await Action.countDocuments({
    $or: [
      { debtorKey: userKey, status: "pending" },
      { creditorKey: userKey, status: { $in: ["pending", "paid"] } },
    ],
  });

  return NextResponse.json({ count });
});
