import { Category } from "./models/category";

const DEFAULT_CATEGORIES = [
  { name: "Mortgage",      settlementType: "immediate" as const, sortOrder: 1 },
  { name: "Groceries",     settlementType: "deferred"  as const, sortOrder: 2 },
  { name: "Bills",         settlementType: "deferred"  as const, sortOrder: 3 },
  { name: "Miscellaneous", settlementType: "deferred"  as const, sortOrder: 4 },
  { name: "Insurance",     settlementType: "deferred"  as const, sortOrder: 5 },
];

// Idempotent — safe to call on every cold start or request.
// Uses upsert so it's also race-condition safe.
export async function seedCategoriesIfEmpty() {
  const count = await Category.countDocuments();
  if (count > 0) return;

  await Category.bulkWrite(
    DEFAULT_CATEGORIES.map((cat) => ({
      updateOne: {
        filter: { name: cat.name },
        update: { $setOnInsert: cat },
        upsert: true,
      },
    }))
  );
}
