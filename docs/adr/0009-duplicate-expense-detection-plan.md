# Plan: Duplicate Detection on Manual Expense Form

## Context

The manual expense form (`/expenses`) has no duplicate detection. Users can accidentally submit the same expense twice — especially when both partners log the same purchase — silently inflating the settlement. CSV import already has duplicate detection (date + amount matching), but the logic is inline and not reusable. This change adds a pre-save duplicate check to the manual form and extracts the matching logic into a shared utility. Design decisions are recorded in ADR-0009.

## Changes

### 1. Create shared duplicate-check utility
**New file:** `src/lib/duplicate-check.ts`

Exports:
- `DuplicateMatch` type — `{ date: string; amount: number; where: string }`
- `checkDuplicateExpenses(date: string, amountCents: number): Promise<DuplicateMatch[]>` — calls the existing `/api/expenses/check-duplicates` endpoint with the same date for both startDate/endDate, filters results to exact amount match, returns `[]` on any failure (best-effort)
- `buildDuplicateMap(expenses: DuplicateMatch[]): Map<string, string>` — builds the `"YYYY-MM-DD|amountCents" → where` map currently inlined in csv-import-form.tsx (lines 69-74)

### 2. Create DuplicateWarningDialog component
**New file:** `src/app/(dashboard)/expenses/_components/duplicate-warning-dialog.tsx`

Follows the `DeleteDialog` pattern (`src/components/delete-dialog.tsx`):
- Props: `open`, `onOpenChange`, `duplicates: DuplicateMatch[]`, `onConfirm`, `loading`
- Shows title "Possible duplicate", lists each match with formatted amount (using `formatCurrency` from `src/lib/utils.ts`) and `where` value
- Footer: Cancel + Save Anyway buttons, both disabled while loading

### 3. Wire into the expense form
**Modify:** `src/app/(dashboard)/expenses/_components/expense-form.tsx`

- Add state: `duplicates`, `showDuplicateDialog`, `pendingValues`, `saving`
- Split current `onSubmit` into two functions:
  - `onSubmit(values)` — computes amountCents, calls `checkDuplicateExpenses`. If matches found, stores pending values and opens dialog. If no matches (or check failed), calls `saveExpense` directly.
  - `saveExpense(values)` — contains the existing POST logic (lines 81-118), manages `saving` state
- Add `handleSaveAnyway` callback — calls `saveExpense(pendingValues)`, closes dialog, clears state
- Render `<DuplicateWarningDialog>` alongside the form
- Submit button disabled when `isSubmitting || saving`

### 4. Update CSV import to use shared utility
**Modify:** `src/app/(dashboard)/expenses/import/_components/csv-import-form.tsx`

Replace inline Map construction (lines 69-74) with `buildDuplicateMap(existingExpenses)`. The API call and row-marking logic stay unchanged — only the Map-building is deduplicated.

### 5. Add unit tests
**New file:** `src/lib/__tests__/duplicate-check.test.ts`

Following the Jest pattern in `src/lib/__tests__/utils.test.ts`:
- `buildDuplicateMap`: empty input, single expense, multiple expenses, duplicate keys
- `checkDuplicateExpenses`: successful match, no match (different amount), fetch failure returns `[]`, non-ok response returns `[]`

## Sequencing

1. `src/lib/duplicate-check.ts` (shared utility)
2. `src/lib/__tests__/duplicate-check.test.ts` (test it)
3. `src/app/(dashboard)/expenses/import/_components/csv-import-form.tsx` (swap to shared utility)
4. `src/app/(dashboard)/expenses/_components/duplicate-warning-dialog.tsx` (new dialog)
5. `src/app/(dashboard)/expenses/_components/expense-form.tsx` (wire it all up)

## Verification

1. Run `npm test` — new tests pass, existing tests unaffected
2. Run `npm run type-check` — no type errors
3. Run `npm run fallow:audit` — no dead code, unused exports, circular dependencies, or complexity regressions
4. Manual test — add an expense, then try to add another with the same date and amount: dialog should appear showing the existing expense's `where`. Clicking "Save Anyway" saves it; clicking "Cancel" returns to the form with values preserved.
5. Manual test — CSV import still works: upload a CSV with known duplicates, verify they're still auto-deselected in the preview table.
6. Manual test — kill the API temporarily and verify the form still saves without showing a dialog (best-effort).
