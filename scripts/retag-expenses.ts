/**
 * Bulk retag expenses based on rules defined in a JSON config file.
 *
 * Usage:
 *   npx tsx scripts/retag-expenses.ts retag-rules.json          # dry run
 *   npx tsx scripts/retag-expenses.ts retag-rules.json --apply   # apply changes
 *
 * Config format (retag-rules.json):
 * {
 *   "rules": [
 *     {
 *       "match": { "where": "Spectrum" },
 *       "fromTag": "Bills",
 *       "toTag": "Bills/Internet"
 *     }
 *   ]
 * }
 *
 * - match: MongoDB query filter (supports $regex, $in, date ranges, etc.)
 * - fromTag: tag path to replace (case-insensitive)
 * - toTag: tag path to replace it with (auto-created if missing)
 * - Other tags on the expense are left untouched
 *
 * Requires MONGODB_URI in .env.
 */

import "dotenv/config";
import * as fs from "fs";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI environment variable is not defined");
  process.exit(1);
}

interface RetagRule {
  match: Record<string, unknown>;
  fromTag: string;
  toTag: string;
}

interface RetagConfig {
  rules: RetagRule[];
}

function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function main() {
  const args = process.argv.slice(2);
  const configPath = args.find((a) => !a.startsWith("--"));
  const applyMode = args.includes("--apply");

  if (!configPath) {
    console.error("Usage: npx tsx scripts/retag-expenses.ts <config.json> [--apply]");
    process.exit(1);
  }

  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  const config: RetagConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (!config.rules?.length) {
    console.error("No rules found in config file");
    process.exit(1);
  }

  console.log(applyMode ? "MODE: APPLY (changes will be written)\n" : "MODE: DRY RUN (no changes)\n");

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);
  console.log("Connected.\n");

  const db = mongoose.connection.db!;
  const tagsCol = db.collection("tags");
  const expensesCol = db.collection("expenses");

  let totalMatched = 0;
  let totalUpdated = 0;

  for (let i = 0; i < config.rules.length; i++) {
    const rule = config.rules[i];
    console.log(`Rule ${i + 1}: "${rule.fromTag}" → "${rule.toTag}" (match: ${JSON.stringify(rule.match)})`);

    const fromTagDoc = await tagsCol.findOne(
      { path: rule.fromTag },
      { collation: { locale: "en", strength: 2 } }
    );

    if (!fromTagDoc) {
      console.log(`  SKIP: fromTag "${rule.fromTag}" not found in database\n`);
      continue;
    }

    let toTagDoc = await tagsCol.findOne(
      { path: rule.toTag },
      { collation: { locale: "en", strength: 2 } }
    );

    if (!toTagDoc && !applyMode) {
      console.log(`  Note: toTag "${rule.toTag}" does not exist yet (will be created on --apply)`);
    }

    if (!toTagDoc && applyMode) {
      // Create ancestors
      const segments = rule.toTag.split("/");
      const maxSort = await tagsCol.findOne({}, { sort: { sortOrder: -1 } });
      let nextSort = ((maxSort?.sortOrder as number) ?? 0) + 1;

      for (let j = 1; j < segments.length; j++) {
        const ancestorPath = segments.slice(0, j).join("/");
        const existing = await tagsCol.findOne(
          { path: ancestorPath },
          { collation: { locale: "en", strength: 2 } }
        );
        if (!existing) {
          await tagsCol.insertOne({ path: ancestorPath, sortOrder: nextSort++ });
          console.log(`  Created ancestor tag: "${ancestorPath}"`);
        }
      }

      const result = await tagsCol.insertOne({ path: rule.toTag, sortOrder: nextSort });
      console.log(`  Created tag: "${rule.toTag}" (${result.insertedId})`);

      toTagDoc = await tagsCol.findOne({ _id: result.insertedId });
    }

    const fromTagId = fromTagDoc._id as mongoose.Types.ObjectId;
    const toTagId = toTagDoc?._id as mongoose.Types.ObjectId | undefined;

    const query = {
      ...rule.match,
      tags: fromTagId,
    };

    const matchedExpenses = await expensesCol.find(query).sort({ date: -1 }).toArray();
    console.log(`  Matched ${matchedExpenses.length} expense(s)`);
    totalMatched += matchedExpenses.length;

    for (const exp of matchedExpenses) {
      const date = formatDate(exp.date as Date);
      const amount = formatCents(exp.amount as number);
      console.log(`    ${date}  ${amount}  ${exp.where}  [${rule.fromTag} → ${rule.toTag}]`);

      if (applyMode && toTagId) {
        const updatedTags = (exp.tags as mongoose.Types.ObjectId[]).map((t) =>
          t.toString() === fromTagId.toString() ? toTagId : t
        );

        await expensesCol.updateOne(
          { _id: exp._id },
          { $set: { tags: updatedTags } }
        );
        totalUpdated++;
      }
    }

    console.log();
  }

  console.log("─".repeat(50));
  console.log(`Total matched: ${totalMatched}`);
  if (applyMode) {
    console.log(`Total updated: ${totalUpdated}`);
  } else {
    console.log("Run with --apply to write changes.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Retag failed:", err);
  process.exit(1);
});
