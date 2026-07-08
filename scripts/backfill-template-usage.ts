import "dotenv/config";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI environment variable is not defined");
  process.exit(1);
}

// fallow-ignore-next-line complexity
async function main() {
  const args = process.argv.slice(2);
  const applyMode = args.includes("--apply");

  console.log(applyMode ? "MODE: APPLY (changes will be written)\n" : "MODE: DRY RUN (no changes)\n");

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);
  console.log("Connected.\n");

  const db = mongoose.connection.db!;
  const activitiesCol = db.collection("activities");
  const templatesCol = db.collection("recurringtemplates");

  const applyEntries = await activitiesCol
    .find({ action: "recurring_apply" })
    .sort({ createdAt: 1 })
    .toArray();

  console.log(`Found ${applyEntries.length} recurring_apply activity entries.\n`);

  const grouped = new Map<string, { count: number; lastDate: Date }>();
  for (const entry of applyEntries) {
    const name = (entry.metadata as Record<string, unknown>)?.templateName as string;
    if (!name) continue;
    const existing = grouped.get(name);
    const createdAt = entry.createdAt as Date;
    if (existing) {
      existing.count++;
      if (createdAt > existing.lastDate) existing.lastDate = createdAt;
    } else {
      grouped.set(name, { count: 1, lastDate: createdAt });
    }
  }

  console.log(`Grouped into ${grouped.size} template name(s).\n`);

  let matched = 0;
  let unmatched = 0;

  for (const [name, stats] of grouped) {
    const template = await templatesCol.findOne({ name });
    if (!template) {
      console.log(`  UNMATCHED: "${name}" (${stats.count} applies) — template not found (deleted?)`);
      unmatched++;
      continue;
    }

    console.log(`  ${name}: ${stats.count} applies, last ${stats.lastDate.toISOString()}`);
    matched++;

    if (applyMode) {
      await templatesCol.updateOne(
        { _id: template._id },
        { $set: { lastAppliedAt: stats.lastDate, applyCount: stats.count } }
      );
      console.log(`    → Updated.`);
    }
  }

  const allTemplates = await templatesCol.find({}).toArray();
  const templatesWithHistory = new Set([...grouped.keys()]);
  const noHistory = allTemplates.filter((t) => !templatesWithHistory.has(t.name as string));
  if (noHistory.length > 0) {
    console.log(`\n  Templates with no apply history:`);
    for (const t of noHistory) {
      console.log(`    - "${t.name}"`);
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Matched: ${matched}, Unmatched: ${unmatched}, No history: ${noHistory.length}`);
  if (!applyMode) {
    console.log("Run with --apply to write changes.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
