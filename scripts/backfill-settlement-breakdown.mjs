#!/usr/bin/env node

import { connectToDatabase } from "../src/lib/db.ts";
import { Settlement } from "../src/lib/models/settlement.ts";
import { fetchMonthBreakdown } from "../src/app/api/settlement/_helpers/close-month.ts";

async function backfillSettlementBreakdown() {
  try {
    console.log("Connecting to database...");
    await connectToDatabase();

    console.log("Fetching all settlements...");
    const settlements = await Settlement.find({}).sort({ year: 1, month: 1 });
    console.log(`Found ${settlements.length} settlements\n`);

    if (settlements.length === 0) {
      console.log("No settlements to backfill.");
      process.exit(0);
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const settlement of settlements) {
      // Skip if already has breakdown data
      if (settlement.person1OwesPerson2 !== undefined && settlement.person2OwesPerson1 !== undefined) {
        console.log(
          `✓ ${settlement.year}-${String(settlement.month).padStart(2, "0")}: Already has breakdown data`,
        );
        skippedCount++;
        continue;
      }

      try {
        // Calculate the breakdown for this month
        const { breakdown } = await fetchMonthBreakdown(settlement.month, settlement.year);

        // Update the settlement with breakdown data
        await Settlement.findByIdAndUpdate(settlement._id, {
          person1OwesPerson2: breakdown.person1OwesPerson2,
          person2OwesPerson1: breakdown.person2OwesPerson1,
        });

        console.log(
          `✓ ${settlement.year}-${String(settlement.month).padStart(2, "0")}: p1 owes p2: ${breakdown.person1OwesPerson2}, p2 owes p1: ${breakdown.person2OwesPerson1}`,
        );
        updatedCount++;
      } catch (err) {
        console.error(
          `✗ ${settlement.year}-${String(settlement.month).padStart(2, "0")}: Error calculating breakdown:`,
          err,
        );
      }
    }

    console.log(`\nBackfill complete!`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    process.exit(0);
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
}

backfillSettlementBreakdown();
