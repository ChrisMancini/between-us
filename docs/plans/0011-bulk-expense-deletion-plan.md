# Bulk Delete Implementation Plan

## Context

Bulk edit was just shipped (commit `9dca952`). The next TODO item is bulk delete with confirmation. ADR-0011 records the design decisions from our grilling session: reuse the same UI flow, API structure, and validation patterns as bulk edit. This plan implements that.

## Slice 1: Extract shared helpers from the bulk route

**File:** `src/app/api/expenses/bulk/route.ts`
**New file:** `src/app/api/expenses/bulk/helpers.ts`

Extract from the PATCH handler into `helpers.ts`:

- **`monthKey(date: Date): string`** — move the existing local function (line 17)
- **`validateExpenseIds(ids: string[]): NextResponse | null`** — extract the ObjectId validation loop (lines 139–143) into a reusable helper that returns a 400 response or null
- **`fetchExpensesAndClosedMonths(expenseIds: string[])`** — extract the expense fetch + settlement query (lines 162–175) into a helper returning `{ expenses, closedMonths: Set<string> }`

Update the PATCH handler to import and call these helpers. Edit-specific helpers (`computeTagUpdate`, `buildUpdate`, `skipReason`, `applyAndLog`) stay in route.ts.

**Verify:** Run existing PATCH tests (`src/app/api/expenses/bulk/__tests__/route.test.ts`) — all 15 must pass unchanged.

## Slice 2: Add Zod schema and types for bulk delete

**File:** `src/lib/validations/bulk-expense.ts` — add `bulkExpenseDeleteSchema`:
```ts
export const bulkExpenseDeleteSchema = z.object({
  expenseIds: z.array(z.string().min(1)).min(1).max(500),
});
```

**File:** `src/types/bulk-expense.ts` — add:
```ts
export interface BulkDeleteResult {
  expenseId: string;
  status: "deleted" | "skipped";
  reason?: string;
}

export interface BulkDeleteResponse {
  results: BulkDeleteResult[];
  summary: { deleted: number; skipped: number };
}
```

## Slice 3: Implement DELETE handler

**File:** `src/app/api/expenses/bulk/route.ts` — add `DELETE` export

The handler:
1. Parse body with `bulkExpenseDeleteSchema`. Return 400 on failure.
2. Call `validateExpenseIds()`. Return early if error.
3. Connect to DB. Call `fetchExpensesAndClosedMonths()`.
4. For each expense:
   - Settled month → skip with reason `"settled"`
   - `!canModifyExpense(session, expense.paidBy)` → skip with reason `"not_owner"`
   - Otherwise: `findByIdAndDelete`, `handleExpenseDelete`, collect date for readiness reset, log `expense_delete` with `(bulk delete)` suffix and `bulkDelete: true` metadata
5. Call `resetReadinessForMonths` once at end with all affected dates.
6. Return `{ results, summary: { deleted, skipped } }`.

Needs tag names for activity log — fetch expenses with `.populate("tags")` in `fetchExpensesAndClosedMonths` (update the helper to accept an optional `populateFields` param, or always populate tags since PATCH ignores them harmlessly).

**Test file:** `src/app/api/expenses/bulk/__tests__/route-delete.test.ts` — follow the exact mocking pattern from `route.test.ts`. Key tests:
- 401 when not authenticated
- 400 when validation fails / invalid ObjectId
- Deletes own expenses successfully
- Skips settled expenses (reason: "settled")
- Skips other user's expenses for non-admin (reason: "not_owner")
- Admin can delete any expense
- Mixed results (some deleted, some skipped)
- Calls `handleExpenseDelete` per deleted expense
- Calls `resetReadinessForMonths` once with all dates
- Logs `expense_delete` with `(bulk delete)` and `bulkDelete: true` per expense

## Slice 4: Build bulk delete confirmation dialog

**New file:** `src/app/(dashboard)/expenses/_components/bulk-delete-confirm-dialog.tsx`

Follow the two-phase pattern from `bulk-edit-confirm-dialog.tsx`:

**Props:** `open`, `onOpenChange`, `selectedExpenses`, `closedMonths`, `currentUserKey`, `isAdmin`, `onDone`

**Phase 1 ("confirming"):**
- Title: "Delete {n} Expenses"
- Description: "This action cannot be undone."
- Show total dollar amount of eligible expenses as a gut-check
- Show ineligible count + reasons (settled / not yours)
- Footer: Cancel (outline) + Delete (destructive, shows "Deleting..." while loading)

**Phase 2 ("results"):**
- Title: "Bulk Delete Complete"
- Description: "{n} deleted, {m} skipped"
- Skip reasons list (inline, same pattern as edit dialog)
- Footer: Done button

`handleDelete()` sends `DELETE /api/expenses/bulk` with `{ expenseIds }`, transitions to results phase, calls `router.refresh()`.

Reuse `monthKeyFromDate` inline (small enough to duplicate from edit dialog). Skip reasons are a subset: `settled` → "month is settled", `not_owner` → "not your expense".

## Slice 5: Wire up the UI

**File:** `src/app/(dashboard)/expenses/_components/bulk-edit-bar.tsx`

- Add `onDelete: () => void` prop
- Add a destructive Delete button with `Trash2` icon, visually separated from Apply/Cancel with a border-left divider
- Delete button is always enabled (no `hasChanges` dependency)

**File:** `src/app/(dashboard)/expenses/_components/expense-list.tsx`

- Add `showDeleteConfirm` boolean state
- Pass `onDelete={() => setShowDeleteConfirm(true)}` to `BulkEditBar`
- Render `BulkDeleteConfirmDialog` when `showDeleteConfirm` is true
- Update `exitBulkEdit` to also reset `showDeleteConfirm`
- Import `BulkDeleteConfirmDialog`

## Slice 6: Verify

1. Run type-check: `npm run type-check`
2. Run all tests: `npx jest`
3. Run fallow audit: `npm run fallow:audit`
4. Start dev server, manually test:
   - Select expenses → click Delete → confirm → verify deleted
   - Select mix of settled/unsettled → verify skip reasons
   - Select other user's expenses as non-admin → verify skipped
   - Verify activity feed shows individual `expense_delete` entries with `(bulk delete)`
   - Verify Escape key closes dialog (not bulk edit mode)
   - Verify "Done" exits bulk edit mode entirely
