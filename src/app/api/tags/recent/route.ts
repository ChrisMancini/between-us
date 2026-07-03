import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { withAuth } from "@/lib/auth-guard";

export const GET = withAuth(async (req, session) => {
  await connectToDatabase();

  const results = await Expense.aggregate([
    { $match: { paidBy: session.user.paidByKey } },
    { $sort: { date: -1, createdAt: -1 } },
    { $limit: 20 },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", lastUsed: { $max: "$date" } } },
    { $sort: { lastUsed: -1 } },
    { $limit: 5 },
  ]);

  return NextResponse.json({
    tagIds: results.map((r) => r._id.toString()),
  });
});
