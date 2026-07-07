import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Expense } from "@/lib/models/expense";
import { withAuth } from "@/lib/auth-guard";

export const GET = withAuth(async (req) => {
  const { searchParams } = req.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const excludeId = searchParams.get("excludeId");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format" },
      { status: 400 }
    );
  }

  const filter: Record<string, unknown> = { date: { $gte: start, $lte: end } };
  if (excludeId && mongoose.isValidObjectId(excludeId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  }

  const expenses = await Expense.find(
    filter,
    { date: 1, amount: 1, where: 1 }
  ).lean();

  return NextResponse.json({
    expenses: expenses.map((e) => ({
      date: (e.date as Date).toISOString(),
      amount: e.amount,
      where: e.where,
    })),
  });
});
