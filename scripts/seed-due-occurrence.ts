import "dotenv/config";
import mongoose from "mongoose";
import {
  describeSchedule,
  occurrencesInRange,
} from "../src/lib/recurring-schedule";
import type { RecurringSchedule } from "../src/lib/models/recurring-template";

/**
 * Dev helper: make an auto-apply template have a *due* occurrence so the next
 * scheduler run applies it — for exercising the Activity page and the
 * `recurring_auto_apply` entry without hand-editing Mongo.
 *
 * Why this is needed: enabling auto-apply stamps `autoApplyEnabledAt = now` and
 * catch-up only considers occurrences dated after that moment (ADR-0018, 2a), so
 * nothing is ever due immediately after enabling. This backdates that timestamp so
 * a recent past occurrence falls in the catch-up window.
 *
 * The in-process timer is disabled outside production, so after seeding, trigger a
 * run from Admin → Scheduler → "Run scheduler now" (POST /api/admin/recurring/run).
 *
 * Usage:
 *   npx tsx scripts/seed-due-occurrence.ts "Monthly Bills"                  # dry run
 *   npx tsx scripts/seed-due-occurrence.ts "Monthly Bills" --apply
 *   npx tsx scripts/seed-due-occurrence.ts --id 65abc... --apply --reset-ledger
 *   npx tsx scripts/seed-due-occurrence.ts "Bills" --since 45 --apply       # backdate 45d (catch-up of several)
 *
 * Flags:
 *   --apply           write changes (default is a dry run)
 *   --id <objectId>   select by _id instead of name
 *   --owner <name|key>  disambiguate when both partners own a template of the same name
 *   --since <days>    backdate this many days (default: target only the most-recent occurrence)
 *   --reset-ledger    delete this template's ledger rows first, so already-applied occurrences re-apply
 *
 * Templates are per-owner (createdBy): the same name can exist once per partner,
 * and the recurring page only lists the logged-in person's — so a name match here
 * can legitimately return two documents.
 */

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI environment variable is not defined");
  process.exit(1);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const apply = args.includes("--apply");
  const resetLedger = args.includes("--reset-ledger");
  const idIdx = args.indexOf("--id");
  const id = idIdx >= 0 ? args[idIdx + 1] : undefined;
  const ownerIdx = args.indexOf("--owner");
  const owner = ownerIdx >= 0 ? args[ownerIdx + 1] : undefined;
  const sinceIdx = args.indexOf("--since");
  const since = sinceIdx >= 0 ? Number(args[sinceIdx + 1]) : undefined;
  // First non-flag token that isn't a flag's value is the template name.
  const valueFlags = new Set(["--id", "--owner", "--since"]);
  const name = args.find(
    (a, i) => !a.startsWith("--") && !valueFlags.has(args[i - 1])
  );
  return { apply, resetLedger, id, owner, since, name };
}

// fallow-ignore-next-line complexity
async function main() {
  const { apply, resetLedger, id, owner, since, name } = parseArgs(process.argv);

  if (!id && !name) {
    console.error(
      'Provide a template name or --id, e.g. npx tsx scripts/seed-due-occurrence.ts "Monthly Bills" --apply'
    );
    process.exit(1);
  }

  console.log(
    apply
      ? "MODE: APPLY (changes will be written)\n"
      : "MODE: DRY RUN (no changes)\n"
  );

  await mongoose.connect(MONGODB_URI!);
  const db = mongoose.connection.db!;
  const templates = db.collection("recurringtemplates");
  const ledger = db.collection("recurringapplylogs");

  const query = id ? { _id: new mongoose.Types.ObjectId(id) } : { name };
  let matches = await templates.find(query).toArray();

  if (matches.length === 0) {
    console.error(`No template found for ${id ? `id ${id}` : `name "${name}"`}.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Resolve owners so an ambiguous name (one per partner) can be picked by
  // --owner or shown clearly, rather than looking like an accidental duplicate.
  const people = await db.collection("people").find({}).toArray();
  const ownerById = new Map(
    people.map((p) => [
      String(p._id),
      p as unknown as { key: string; displayName: string },
    ])
  );
  const ownerLabel = (t: (typeof matches)[number]) => {
    const o = ownerById.get(String(t.createdBy));
    return o ? `${o.displayName} (${o.key})` : String(t.createdBy);
  };

  if (owner) {
    const want = owner.toLowerCase();
    matches = matches.filter((t) => {
      const o = ownerById.get(String(t.createdBy));
      return (
        o &&
        (o.key.toLowerCase() === want || o.displayName.toLowerCase() === want)
      );
    });
    if (matches.length === 0) {
      console.error(`No template "${name}" owned by "${owner}".`);
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  if (matches.length > 1) {
    console.error(
      `Multiple templates named "${name}" (one per owner). Re-run with --owner <name|key> or --id <id>:`
    );
    for (const t of matches) {
      console.error(
        `  ${t._id}  owner=${ownerLabel(t)}  autoApply=${!!t.autoApplyEnabled}`
      );
    }
    await mongoose.disconnect();
    process.exit(1);
  }

  const template = matches[0];
  if (!template.autoApplyEnabled || !template.schedule) {
    console.error(
      `Template "${template.name}" isn't auto-apply enabled with a schedule — enable it in the app first.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const schedule = template.schedule as RecurringSchedule;
  const now = new Date();

  console.log(`Template: ${template.name} (${template._id})`);
  console.log(`Owner: ${ownerLabel(template)}`);
  console.log(`Schedule: ${describeSchedule(schedule)}\n`);

  // Choose the enablement moment. By default anchor it one second before the most
  // recent past occurrence so exactly that one occurrence becomes due; --since
  // backdates further to exercise catch-up of several missed occurrences.
  let enabledAt: Date;
  if (since != null && !Number.isNaN(since)) {
    enabledAt = new Date(now.getTime() - since * DAY_MS);
  } else {
    const recent = occurrencesInRange(
      schedule,
      new Date(now.getTime() - 90 * DAY_MS),
      now
    );
    if (recent.length === 0) {
      console.error(
        "No occurrence in the last 90 days — pass --since <days> to backdate further."
      );
      await mongoose.disconnect();
      process.exit(1);
    }
    const target = recent[recent.length - 1];
    enabledAt = new Date(target.getTime() - 1000);
  }

  const due = occurrencesInRange(schedule, enabledAt, now);
  console.log(`Would set autoApplyEnabledAt = ${enabledAt.toISOString()}`);
  console.log(`Occurrences that become due (${due.length}):`);
  for (const d of due) console.log(`  - ${d.toISOString().slice(0, 10)}`);

  const ledgerCount = await ledger.countDocuments({ templateId: template._id });
  if (resetLedger) {
    console.log(`\nLedger rows for this template: ${ledgerCount} (would delete)`);
  } else if (ledgerCount > 0) {
    console.log(
      `\nNote: ${ledgerCount} ledger row(s) exist — already-applied occurrences won't re-apply. Add --reset-ledger to clear them.`
    );
  }

  if (!apply) {
    console.log("\nDry run — re-run with --apply to write.");
    await mongoose.disconnect();
    return;
  }

  if (resetLedger) {
    const res = await ledger.deleteMany({ templateId: template._id });
    console.log(`\nDeleted ${res.deletedCount} ledger row(s).`);
  }
  await templates.updateOne(
    { _id: template._id },
    { $set: { autoApplyEnabledAt: enabledAt } }
  );
  console.log("Updated autoApplyEnabledAt.");

  console.log(
    '\nNext: Admin → Scheduler → "Run scheduler now" (the hourly timer is off outside production).'
  );
  console.log(
    "Note: expenses already logged within ±3 days of an occurrence (same where + tag) are skipped as duplicates."
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("seed-due-occurrence failed:", err);
  process.exit(1);
});
