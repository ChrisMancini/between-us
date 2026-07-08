# Template Usage History Implementation Plan

## Context

Recurring templates show no indication of whether or how often they've been used. Per ADR 0017, we'll add `lastAppliedAt` and `applyCount` fields to the template document, update them on each apply, display usage stats in the template card header, enrich the activity log metadata with `templateId`, and backfill existing data via a one-time migration script.

## Step 1: Schema and type changes

**`src/lib/models/recurring-template.ts`**

- Add `lastAppliedAt: Date | null` and `applyCount: number` to `IRecurringTemplate` interface (after line 18)
- Add `lastAppliedAt: string | null` and `applyCount: number` to `SerializedRecurringTemplate` interface (after line 35)
- Add both fields to `RecurringTemplateSchema` (after the `items` field, around line 78):
  ```typescript
  lastAppliedAt: { type: Date, default: null },
  applyCount: { type: Number, default: 0 },
  ```

Mongoose defaults handle existing documents — no schema migration needed.

## Step 2: Serializer update

**`src/lib/recurring-template-utils.ts`**

- Update `serializeTemplate` input type (the intersection type around line 51) to include `lastAppliedAt: Date | null` and `applyCount: number`
- Add to the returned object (after `updatedAt`, around line 64):
  ```typescript
  lastAppliedAt: t.lastAppliedAt ? t.lastAppliedAt.toISOString() : null,
  applyCount: t.applyCount ?? 0,
  ```

The `?? 0` fallback handles pre-migration documents where the field is absent.

## Step 3: Add `formatShortDate` utility (TDD)

**Tests first** in `src/lib/__tests__/utils.test.ts` — new `describe("formatShortDate")` block using `jest.useFakeTimers()` / `jest.setSystemTime()` (same pattern as `formatMonthYear` tests at line 41):
- Formats a date with year: `"Jun 5, 2025"`
- With `omitCurrentYear: true` and current-year date, omits year: `"Jun 5"`
- With `omitCurrentYear: true` and past-year date, includes year: `"Jun 5, 2025"`
- Without options, always includes year

**Then implement** in `src/lib/utils.ts`:
```typescript
export function formatShortDate(
  date: string | Date,
  options?: { omitCurrentYear?: boolean }
): string {
  const d = new Date(date);
  const sameYear =
    options?.omitCurrentYear && d.getUTCFullYear() === new Date().getUTCFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
```

Follows the existing `toLocaleDateString` pattern from `expense-row.tsx` (line 22) with the `omitCurrentYear` option pattern from `formatMonthYear`.

## Step 4: Apply route changes (TDD)

**Tests first** in `src/app/api/recurring/[id]/apply/__tests__/route.test.ts`:
- Add `updateOne: jest.fn()` to the `RecurringTemplate` mock factory (line 22)
- Add `RecurringTemplate.updateOne` mock setup in the success test (line 141)
- Assert `RecurringTemplate.updateOne` was called with `{ _id: VALID_ID }` and `{ $set: { lastAppliedAt: expect.any(Date) }, $inc: { applyCount: 1 } }`
- Assert `logActivity` metadata contains `templateId: VALID_ID`

**Then implement** in `src/app/api/recurring/[id]/apply/route.ts`:
- After `Expense.insertMany` (line 79), before `resetReadinessForMonths` (line 81):
  ```typescript
  await RecurringTemplate.updateOne(
    { _id: id },
    { $set: { lastAppliedAt: new Date() }, $inc: { applyCount: 1 } }
  );
  ```
- Add `templateId: id` to the `logActivity` metadata object (line 89-93)

Using `updateOne` instead of `findOneAndUpdate` since we don't need the returned document.

## Step 5: Template card UI

**`src/app/(dashboard)/recurring/_components/template-list.tsx`**

- Import `formatShortDate` alongside `formatCurrency` from `@/lib/utils` (line 14)
- Restructure the header (lines 81-89):
  - Change `items-center` to `items-start` on the flex container
  - Wrap the right-side `<p>` in a `<div className="text-right">` to stack two lines
  - Add a second `<p className="text-xs text-muted-foreground/70 mt-0.5">` below:
    - When `template.lastAppliedAt`: `"Last applied {date} · {count} time(s)"`
    - When null: `"Never applied"`

## Step 6: Migration script

**`scripts/backfill-template-usage.ts`** (new file)

Follow the `retag-expenses.ts` pattern: `dotenv/config`, `mongoose.connect()`, raw collection access, dry-run by default with `--apply` flag.

1. Find all `recurring_apply` activity entries, sorted by `createdAt`
2. Group by `metadata.templateName` — compute count and latest date per name
3. Match each group to a template by name via the `recurringtemplates` collection
4. Update matched templates with `$set: { lastAppliedAt, applyCount }`
5. Log unmatched names (deleted templates) and templates with no history

Run via `npx tsx scripts/backfill-template-usage.ts [--apply]`.

## Verification

1. Run tests: `npx jest --testPathPattern="utils.test|recurring.*apply.*route.test"`
2. Run type-check: `npm run type-check`
3. Run full test suite: `npm test`
4. Run fallow audit: `npm run fallow:audit`
5. Visual: visit `/recurring`, confirm "Never applied" on cards, apply a template, confirm stats update

## Files Changed

| File | Change |
|------|--------|
| `src/lib/models/recurring-template.ts` | Add `lastAppliedAt` and `applyCount` to interface, serialized interface, and schema |
| `src/lib/recurring-template-utils.ts` | Pass through new fields in `serializeTemplate` |
| `src/lib/utils.ts` | Add `formatShortDate` utility |
| `src/lib/__tests__/utils.test.ts` | Add `formatShortDate` test suite |
| `src/app/api/recurring/[id]/apply/route.ts` | Update template stats + add `templateId` to activity metadata |
| `src/app/api/recurring/[id]/apply/__tests__/route.test.ts` | Add assertions for `updateOne` and `templateId` |
| `src/app/(dashboard)/recurring/_components/template-list.tsx` | Display usage stats in card header |
| `scripts/backfill-template-usage.ts` | One-time migration script (new file) |
