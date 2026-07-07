# Code Health Plan

Reduce cyclomatic/cognitive complexity flagged by fallow, targeting a clean `npm run fallow` build with zero `fallow-ignore-next-line complexity` suppressions on production code.

## Target 1: Suppress migration scripts

**Status:** Done

Add `// fallow-ignore-next-line complexity` to run-once migration scripts. These are operational scripts, not production code — suppression is the right call.

- `scripts/migrate-categories-to-tags.ts` — `main()`
- `scripts/retag-expenses.ts` — `main()`

## Target 2: SettlementPage — extract data-fetching and components

**Status:** Done

Extract the 589-line `page.tsx` into focused files:

- `_helpers/fetch-settlement-data.ts` — all DB queries, serialization, calculation
- `_components/settlement-alerts.tsx` — reopened/unsettled/closed alert banners
- `_components/net-result-card.tsx` — net result display with running balance
- `_components/expense-table.tsx` — expense breakdown table

Page shrinks to ~130 lines composing extracted pieces. Unit tests cover the data-fetching helper.

## Target 3: Settlement POST handler

Extract settlement creation/closing logic from `src/app/api/settlement/route.ts` into a helper.

## Target 4: BulkEditConfirmDialog / BulkDeleteConfirmDialog

Extract shared two-phase confirmation pattern from both dialogs.

## Target 5: Bulk expense PATCH handler

Extract validation and update logic from `src/app/api/expenses/bulk/route.ts`.

## Target 6: CsvFormatFormDialog

Reduce complexity in `src/app/(dashboard)/admin/csv-formats/_components/csv-format-form-dialog.tsx`.

## Target 7: Expense PUT handler

Reduce complexity in `src/app/api/expenses/[id]/route.ts` PUT handler.

## Target 8: AuthSettingsForm handleSave

Reduce complexity in `src/app/(dashboard)/admin/auth/_components/auth-settings-form.tsx`.

## Target 9: FileUploadStep complete

Reduce complexity in `src/app/(dashboard)/expenses/import/_components/file-upload-step.tsx`.

## Target 10: Setup POST handler

Reduce complexity in `src/app/api/setup/route.ts` POST handler.
