/**
 * One-time migration: Categories → Tags
 *
 * Converts existing Category documents to Tag documents,
 * updates all Expenses, RecurringTemplates, and CsvFormats.
 *
 * Run: npx tsx scripts/migrate-categories-to-tags.ts
 *
 * Requires MONGODB_URI in .env (loaded via dotenv).
 * Interactive: prompts for each category→tag mapping.
 * Idempotent: safe to re-run.
 */

import "dotenv/config";
import mongoose from "mongoose";
import * as readline from "readline";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI environment variable is not defined");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);
  console.log("Connected.\n");

  const db = mongoose.connection.db!;
  const categoriesCol = db.collection("categories");
  const tagsCol = db.collection("tags");
  const expensesCol = db.collection("expenses");
  const templatesCol = db.collection("recurringtemplates");
  const csvFormatsCol = db.collection("csvformats");

  // Step 1: Read all categories
  const categories = await categoriesCol.find().sort({ sortOrder: 1 }).toArray();

  if (categories.length === 0) {
    console.log("No categories found. Nothing to migrate.");
    rl.close();
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${categories.length} categories:\n`);

  // Step 2: Interactive mapping
  const mappings: Array<{
    categoryId: mongoose.Types.ObjectId;
    categoryName: string;
    settlementType: string;
    tagPath: string;
  }> = [];

  for (const cat of categories) {
    const defaultPath = cat.name as string;
    const answer = await ask(
      `  ${cat.name} (${cat.settlementType}) → [${defaultPath}]: `
    );
    const tagPath = answer || defaultPath;
    mappings.push({
      categoryId: cat._id as mongoose.Types.ObjectId,
      categoryName: cat.name as string,
      settlementType: cat.settlementType as string,
      tagPath,
    });
  }

  console.log("\nMappings to apply:");
  for (const m of mappings) {
    console.log(`  ${m.categoryName} → "${m.tagPath}" (${m.settlementType})`);
  }

  const confirm = await ask("\nProceed? (y/N): ");
  if (confirm.toLowerCase() !== "y") {
    console.log("Aborted.");
    rl.close();
    await mongoose.disconnect();
    return;
  }

  // Step 3: Create tags (with ancestors)
  const categoryIdToTagId = new Map<string, mongoose.Types.ObjectId>();
  const categoryIdToSettlementType = new Map<string, string>();
  let nextSortOrder = 1;

  // Collect all unique paths (including ancestors)
  const allPaths = new Set<string>();
  for (const m of mappings) {
    allPaths.add(m.tagPath);
    const segments = m.tagPath.split("/");
    for (let i = 1; i < segments.length; i++) {
      allPaths.add(segments.slice(0, i).join("/"));
    }
  }

  // Create tags
  for (const path of allPaths) {
    const existing = await tagsCol.findOne(
      { path },
      { collation: { locale: "en", strength: 2 } }
    );
    if (!existing) {
      const result = await tagsCol.insertOne({
        path,
        sortOrder: nextSortOrder++,
      });
      console.log(`  Created tag: "${path}" (${result.insertedId})`);
    } else {
      console.log(`  Tag already exists: "${path}" (${existing._id})`);
    }
  }

  // Build the category→tag mapping
  for (const m of mappings) {
    const tag = await tagsCol.findOne(
      { path: m.tagPath },
      { collation: { locale: "en", strength: 2 } }
    );
    if (!tag) {
      console.error(`ERROR: Tag not found for path "${m.tagPath}"`);
      process.exit(1);
    }
    categoryIdToTagId.set(
      m.categoryId.toString(),
      tag._id as mongoose.Types.ObjectId
    );
    categoryIdToSettlementType.set(m.categoryId.toString(), m.settlementType);
  }

  // Step 4: Migrate expenses
  console.log("\nMigrating expenses...");
  const expenses = await expensesCol.find({ category: { $exists: true } }).toArray();
  let expenseCount = 0;

  for (const exp of expenses) {
    const catId = exp.category?.toString();
    if (!catId) continue;

    const tagId = categoryIdToTagId.get(catId);
    const settlementType = categoryIdToSettlementType.get(catId) ?? "deferred";

    if (!tagId) {
      console.warn(`  WARNING: No tag mapping for category ${catId} on expense ${exp._id}`);
      continue;
    }

    await expensesCol.updateOne(
      { _id: exp._id },
      {
        $set: { tags: [tagId], settlementType },
        $unset: { category: "" },
      }
    );
    expenseCount++;
  }
  console.log(`  Migrated ${expenseCount} expenses.`);

  // Step 5: Migrate recurring templates
  console.log("\nMigrating recurring templates...");
  const templates = await templatesCol.find().toArray();
  let templateCount = 0;

  for (const tmpl of templates) {
    const items = tmpl.items as Array<Record<string, unknown>>;
    if (!items?.length) continue;

    let modified = false;
    const updatedItems = items.map((item) => {
      const catId = item.categoryId?.toString();
      if (!catId) return item;

      const tagId = categoryIdToTagId.get(catId);
      const settlementType = categoryIdToSettlementType.get(catId) ?? "deferred";

      if (!tagId) {
        console.warn(`  WARNING: No tag mapping for category ${catId} in template ${tmpl._id}`);
        return item;
      }

      modified = true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { categoryId, ...rest } = item;
      return { ...rest, tagIds: [tagId], settlementType };
    });

    if (modified) {
      await templatesCol.updateOne(
        { _id: tmpl._id },
        { $set: { items: updatedItems } }
      );
      templateCount++;
    }
  }
  console.log(`  Migrated ${templateCount} templates.`);

  // Step 6: Migrate CSV formats
  console.log("\nMigrating CSV formats...");
  const csvFormats = await csvFormatsCol
    .find({ categoryMappings: { $exists: true } })
    .toArray();
  let formatCount = 0;

  for (const fmt of csvFormats) {
    const catMappings = fmt.categoryMappings as Array<{
      sourceValue: string;
      categoryId: mongoose.Types.ObjectId;
    }>;
    if (!catMappings?.length) continue;

    const tagMappings = catMappings.map((cm) => {
      const tagId = categoryIdToTagId.get(cm.categoryId.toString());
      return {
        sourceValue: cm.sourceValue,
        tagIds: tagId ? [tagId] : [],
      };
    });

    const update: Record<string, unknown> = {
      $set: { tagMappings },
      $unset: { categoryMappings: "" },
    };

    if (fmt.categoryColumn) {
      (update.$set as Record<string, unknown>).tagColumn = fmt.categoryColumn;
      (update.$unset as Record<string, unknown>).categoryColumn = "";
    }

    await csvFormatsCol.updateOne({ _id: fmt._id }, update);
    formatCount++;
  }
  console.log(`  Migrated ${formatCount} CSV formats.`);

  console.log("\nMigration complete!");
  console.log(
    "Note: The old 'categories' collection has been left intact as a backup."
  );
  console.log(
    "You can drop it manually after verifying the migration: db.categories.drop()"
  );

  rl.close();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  rl.close();
  process.exit(1);
});
