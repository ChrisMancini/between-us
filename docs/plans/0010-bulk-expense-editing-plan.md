# Bulk Expense Editing — Implementation Plan

## Context

The expense list only supports editing one expense at a time via a dialog. Users need to recategorize, reclassify, or retype many expenses at once — especially early on while establishing tagging conventions. ADR 0010 (`docs/adr/0010-bulk-expense-editing.md`) captures all the design decisions. This plan covers implementation.

## New Files

### 1. `src/lib/validations/bulk-expense.ts` — Zod schema for bulk edit API

```typescript
{
  expenseIds: string[];  // 1–500
  tags?: { mode: "replace" | "add" | "remove"; tagIds: string[] };
  splitType?: "split" | "full";
  settlementType?: "immediate" | "deferred";
}
```

At least one of `tags`, `splitType`, or `settlementType` must be present (`.refine()`).

### 2. `src/app/api/expenses/bulk/route.ts` — PATCH endpoint

**Response shape:**
```typescript
{
  results: Array<{
    expenseId: string;
    status: "updated" | "skipped";
    reason?: "settled" | "not_owner" | "no_changes" | "min_tags";
    changedFields?: string[];
  }>;
  summary: { updated: number; skipped: number };
}
```

**Algorithm:**
1. Validate body with `bulkExpenseUpdateSchema`
2. Validate all tag IDs exist (if tags field present)
3. Fetch all expenses by ID in one query
4. Build `closedMonths` set from Settlement records for the months spanned by fetched expenses
5. Loop each expense, per-field eligibility:
   - Tags: always eligible
   - Split/Settlement type: only if NOT settled AND `canModifyExpense` passes (payer or admin)
6. Compute tag changes per expense based on mode (replace/add/remove). Skip if remove would leave 0 tags.
7. Update each changed expense via `findByIdAndUpdate` (need old doc for `handleExpenseChange`)
8. For settlement type changes: call `handleExpenseChange()` from `src/lib/action-lifecycle.ts`
9. Log activity per expense: `"expense_edit"` with `"(bulk edit)"` suffix in summary, `bulkEdit: true` in metadata
10. Call `resetReadinessForMonths` once with dates from expenses where split type or settlement type changed (skip if only tags changed)
11. Return results array

Uses `withAuth` (no route context needed — no `[id]` param). Reuses: `canModifyExpense`, `handleExpenseChange`, `getOtherPersonKey`, `logActivity`, `resetReadinessForMonths`, `formatCurrency` — all from existing modules.

### 3. `src/app/(dashboard)/expenses/_components/bulk-edit-bar.tsx` — Sticky action bar

Horizontal bar between filters and table. Manages its own form state for the three fields.

**Contents (left to right):**
- Selected count pill: "N selected"
- Tag mode toggle (Replace / Add / Remove) + TagPicker (`@/components/tag-picker`)
- Split type Select: No change / 50/50 / Full
- Settlement type Select: No change / Immediate / Deferred
- Apply button (primary, disabled when all fields are "no change")
- Cancel button (ghost)

**Props:** `selectedCount`, `tags: SerializedTag[]`, `onApply: (values: BulkEditValues) => void`, `onCancel: () => void`

### 4. `src/app/(dashboard)/expenses/_components/bulk-edit-confirm-dialog.tsx` — Two-phase dialog

**Phase 1 — Confirming:** Shows change summary, expected skips (computed client-side from selected expenses + closedMonths + currentUserKey), settlement type warning if applicable. Cancel / Apply Changes buttons.

**Phase 2 — Results:** Shows "N updated, M skipped" with skip reasons. Done button exits bulk edit mode.

**Props:** `open`, `onOpenChange`, `selectedExpenses`, `closedMonths`, `currentUserKey`, `values: BulkEditValues`, `tags`, `onDone`

### 5. `src/types/bulk-expense.ts` — Shared types

```typescript
export interface BulkEditValues {
  tags?: { mode: "replace" | "add" | "remove"; tagIds: string[] };
  splitType?: "split" | "full";
  settlementType?: "immediate" | "deferred";
}

export interface BulkEditResult {
  expenseId: string;
  status: "updated" | "skipped";
  reason?: string;
  changedFields?: string[];
}

export interface BulkEditResponse {
  results: BulkEditResult[];
  summary: { updated: number; skipped: number };
}
```

## Modified Files

### `src/app/(dashboard)/expenses/_components/expense-list.tsx`

Currently 181 lines. Changes:

- Add state: `bulkEditMode: boolean`, `selectedIds: Set<string>`
- Add "Select" button in the header bar (right side, next to expense count). In bulk mode, swap header to show "N selected" + "Cancel" button.
- Add checkbox column (first column) when `bulkEditMode` is true, with select-all checkbox in thead
- Add `useEffect` for Escape key to exit bulk edit mode
- Render `<BulkEditBar>` above the table when in bulk edit mode with selections
- Render `<BulkEditConfirmDialog>`
- Hide per-row edit/delete action buttons during bulk edit mode
- After successful bulk edit: `router.refresh()` to refetch server data

The component will grow to ~220 lines. If needed, extract the table body into a sub-component, but try the inline approach first — the added logic is mostly conditional rendering, not new complexity.

## Implementation Order

### Step 1: Shared types and validation schema
- `src/types/bulk-expense.ts`
- `src/lib/validations/bulk-expense.ts`

### Step 2: API route
- `src/app/api/expenses/bulk/route.ts`
- Follows the same patterns as `src/app/api/expenses/[id]/route.ts`

### Step 3: API route tests
- `src/app/api/expenses/bulk/__tests__/route.test.ts`
- Follow the pattern in `src/app/api/expenses/[id]/__tests__/route-put.test.ts`: jest.mock all deps, use helpers from `@/test/api-helpers`
- Test cases: auth (401), validation (400), tag replace/add/remove, split/settlement eligibility for settled expenses, split/settlement eligibility for non-owner, partial application, no-change skip, `handleExpenseChange` called for settlement type changes, activity logging with "(bulk edit)" suffix, mixed results (some updated, some skipped)

### Step 4: BulkEditBar component
- `src/app/(dashboard)/expenses/_components/bulk-edit-bar.tsx`
- Self-contained form with internal state

### Step 5: BulkEditConfirmDialog component
- `src/app/(dashboard)/expenses/_components/bulk-edit-confirm-dialog.tsx`
- Two-phase dialog with API call

### Step 6: Wire into ExpenseList
- Modify `src/app/(dashboard)/expenses/_components/expense-list.tsx`
- Add bulk edit mode toggle, selection state, checkbox column
- Integrate BulkEditBar and BulkEditConfirmDialog
- Test end-to-end in browser

## Key Reusable Code

| What | Where |
|---|---|
| `canModifyExpense` | `src/lib/auth-guard.ts:5` |
| `withAuth` | `src/lib/auth-guard.ts:9` |
| `handleExpenseChange` | `src/lib/action-lifecycle.ts:118` |
| `getOtherPersonKey` | `src/lib/action-lifecycle.ts:10` |
| `logActivity` | `src/lib/activity-logger.ts` |
| `resetReadinessForMonths` | `src/lib/readiness-reset.ts` |
| `assertMonthsOpen` | `src/lib/settlement-guard.ts:5` (reference pattern, not directly used — bulk edit skips rather than blocks) |
| `formatCurrency` | `src/lib/utils.ts` |
| `TagPicker` | `src/components/tag-picker.tsx` |
| `validationError`, `invalidId` | `src/lib/api-utils.ts` |
| Settled check pattern | `expense-list.tsx:89` — `closedMonths.has(\`${year}-${month}\`)` |

## Verification

### Automated (run by Claude)
1. `npm run type-check` — no TypeScript errors
2. `npm run lint` — no ESLint errors
3. `npm test` — all tests pass (existing + new bulk route tests)
4. `npm run test:ci` — coverage meets 80% threshold on branches/functions/lines/statements
5. `npm run fallow:audit` — no complexity regressions or dead code

### Manual (browser testing by Chris)
- Enter bulk edit mode via "Select" button
- Check/uncheck individual rows and select-all
- Exit via Cancel and Escape
- Set tag replace/add/remove with tag picker
- Set split type and settlement type
- Apply with a mix of settled/unsettled, own/other expenses
- Verify confirmation dialog shows correct skip counts
- Verify results summary shows updated/skipped counts
- Verify Done exits bulk edit mode and table refreshes
- Verify activity feed shows "(bulk edit)" entries
- Verify settlement type change creates action items
