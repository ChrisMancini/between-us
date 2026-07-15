import "dotenv/config";
import mongoose from "mongoose";
import { Settlement } from "@/lib/models/settlement";
import { Expense } from "@/lib/models/expense";
import { Tag } from "@/lib/models/tag";
import { calculateSettlement } from "@/lib/settlement-calc";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI environment variable is not defined");
  process.exit(1);
}

async function calculateMonthBreakdown(month: number, year: number, person1Key: string, person2Key: string) {

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const expenses = await Expense.find({
    date: { $gte: start, $lt: end },
  })
    .populate("tags")
    .lean();

  const rows = (expenses as unknown as Array<Record<string, unknown>>)
    .filter((e) => {
      const tags = e.tags as unknown;
      return Array.isArray(tags) && tags.length > 0;
    })
    .map((e) => {
      const tags = e.tags as Array<Record<string, unknown>>;
      return {
        _id: (e._id as mongoose.Types.ObjectId).toString(),
        paidBy: e.paidBy as string,
        amount: e.amount as number,
        splitType: e.splitType as "split" | "full",
        settlementType: e.settlementType as "immediate" | "deferred",
        where: e.where as string,
        date: (e.date as Date).toISOString(),
        tags: tags.map((t) => ({
          _id: (t._id as mongoose.Types.ObjectId).toString(),
          path: t.path as string,
          sortOrder: t.sortOrder as number,
          name: (t.path as string).split("/").pop() ?? "",
          parent: "",
          depth: 1,
        })),
      };
    });

  const breakdown = calculateSettlement(rows, person1Key, person2Key);
  return breakdown;
}

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);
  console.log("Connected.\n");

  // Get person keys from settings (hardcoded as person1/person2 for now)
  const person1Key = "person1";
  const person2Key = "person2";

  console.log("Fetching all settlements...");
  const settlements = await Settlement.find({}).sort({ year: 1, month: 1 });
  console.log(`Found ${settlements.length} settlements\n`);

  if (settlements.length === 0) {
    console.log("No settlements to backfill.");
    await mongoose.disconnect();
    process.exit(0);
  }

  let updatedCount = 0;
  let skippedCount = 0;

  for (const settlement of settlements) {
    const monthStr = `${settlement.year}-${String(settlement.month).padStart(2, "0")}`;

    // Skip if already has breakdown data
    if (settlement.person1OwesPerson2 !== undefined && settlement.person2OwesPerson1 !== undefined) {
      console.log(`✓ ${monthStr}: Already has breakdown data`);
      skippedCount++;
      continue;
    }

    try {
      // Calculate the breakdown for this month
      const breakdown = await calculateMonthBreakdown(settlement.month, settlement.year, person1Key, person2Key);

      // Update the settlement with breakdown data
      await Settlement.findByIdAndUpdate(settlement._id, {
        person1OwesPerson2: breakdown.person1OwesPerson2,
        person2OwesPerson1: breakdown.person2OwesPerson1,
      });

      console.log(
        `✓ ${monthStr}: p1 owes p2: ${breakdown.person1OwesPerson2}, p2 owes p1: ${breakdown.person2OwesPerson1}`,
      );
      updatedCount++;
    } catch (err) {
      console.error(`✗ ${monthStr}: Error calculating breakdown:`, err);
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
