# Quick-Entry Mode — Implementation Plan

## Context

The full expense form has 7 fields and lives only on `/expenses`. Most daily expenses share the same defaults (50/50 split, deferred settlement) and differ only in amount, where, and tag. This feature adds a floating action button (FAB) that opens a minimal drawer from any dashboard page, reducing expense entry to 3–4 inputs. Spec: `docs/adr/0012-quick-entry-mode.md`.

## Slices

### 1. Install ShadCN Drawer

Run `npx shadcn@latest add drawer`. This installs `vaul` and generates `src/components/ui/drawer.tsx`.

### 2. Recent Tags API

**New file:** `src/app/api/tags/recent/route.ts`

GET endpoint (wrapped with `withAuth` from `src/lib/auth-guard.ts`) that returns the 5 most recently used tag IDs for the current user. Aggregation pipeline on `Expense` collection:

```
$match { paidBy: session.user.paidByKey }
$sort { date: -1, createdAt: -1 }
$limit 20
$unwind "$tags"
$group { _id: "$tags", lastUsed: { $max: "$date" } }
$sort { lastUsed: -1 }
$limit 5
```

Returns `{ tagIds: string[] }`. Follow the pattern in `src/app/api/expenses/check-duplicates/route.ts`.

**New test file:** `src/app/api/tags/recent/__tests__/route.test.ts`

Unit tests using the project's existing Jest + mock pattern (see `src/test/api-helpers.ts` for `makeSession`, `asMock`, `makeGetRequest`, `expectStatus`). Mock `Expense.aggregate` to return controlled results. Test cases:

- Returns 401 when not authenticated
- Returns the 5 most recently used tag IDs for the current user
- Deduplicates tags across multiple expenses (pipeline returns unique IDs)
- Returns empty array when the user has no expenses
- Excludes tags from the other user's expenses (pipeline filters by `paidBy`)

### 3. Hotkey Changes

**Modify:** `src/hooks/use-hotkeys.ts`
- Export new constant: `OPEN_QUICK_ENTRY_EVENT = "open-quick-entry"`
- Replace the `n` key handler (lines 73–81): always dispatch `OPEN_QUICK_ENTRY_EVENT` on window (remove the `/expenses` special case and `FOCUS_EXPENSE_FORM_EVENT` dispatch — the expense form's focus listener stays but is no longer triggered by the hotkey)

**Modify:** `src/components/keyboard-shortcuts-dialog.tsx`
- Change `n` label from "New expense" to "Quick add expense" (line 91)
- Add two new rows under Actions: `Enter` → "Save" and `Ctrl+Enter` → "Save & add another"

### 4. Quick-Entry Components (Core)

**New file:** `src/components/quick-entry/quick-entry-fab.tsx`
- "use client" component rendering:
  - Fixed FAB button: `fixed bottom-6 right-6 z-50`, round, `Plus` icon, primary color, tooltip "Quick add expense (n)"
  - `Drawer` (from `src/components/ui/drawer.tsx`) controlled by `open` state
- Hides when `usePathname().startsWith("/admin")`
- Listens for `OPEN_QUICK_ENTRY_EVENT` to open the drawer
- Fetches tags (`GET /api/tags`) and recent tag IDs (`GET /api/tags/recent`) lazily when drawer opens
- Props: `paidBy: string` (passed from layout)
- Contains `<QuickEntryForm>` inside the drawer body

**New file:** `src/components/quick-entry/quick-entry-form.tsx`
- React Hook Form with dedicated Zod schema (amount, where, date, tagIds only)
- Hidden defaults at submit time: `splitType: "split"`, `settlementType: "deferred"`, `paidBy` from props, `notes: undefined`
- Field layout (single column): amount (auto-focused) → where → date → tag chips → buttons
- Date field: simple `<input type="date">` pre-filled with today (keep it compact for the drawer — no calendar popover)
- Two submit paths via a `saveMode` ref:
  - "Save" button / `Enter`: save + close drawer (calls `onClose` prop)
  - "Save & add another" button / `Ctrl+Enter`: save + reset form + re-focus amount
- `Ctrl+Enter` handled via `onKeyDown` on the `<form>` element checking `(e.ctrlKey || e.metaKey) && e.key === "Enter"`
- After successful save: `toast.success("Expense added")`, `router.refresh()`
- Post-save non-blocking duplicate detection: fire-and-forget `checkDuplicateExpenses()` from `src/lib/duplicate-check.ts`. If matches found, `toast("Possible duplicate", { description: "..." })`
- "Full form" link: builds URL `/expenses?prefill_amount=...&prefill_where=...&prefill_date=...&prefill_tags=...` and navigates via `router.push()`

**New file:** `src/components/quick-entry/quick-entry-tag-chips.tsx`
- Props: `tags`, `recentTagIds`, `selectedTagIds`, `onSelectedChange`, `onTagCreated`
- Renders recent tags as clickable `Badge` chips (toggle selection on click)
- Selected chips styled with `variant="default"`, unselected with `variant="outline"`
- "More..." button opens the full `TagPicker` (from `src/components/tag-picker.tsx`) as a popover
- Non-recent selected tags shown as additional chips

### 5. Wire FAB into Layout

**Modify:** `src/app/(dashboard)/layout.tsx`
- Import and render `<QuickEntryFab paidBy={session.user.paidByKey} />` inside `<PersonsProvider>` after `{children}` (after line 74)
- The `paidBy` value is already available from `session.user.paidByKey`

### 6. URL Param Pre-filling for Full Form

**Modify:** `src/app/(dashboard)/expenses/page.tsx`
- Add optional prefill search params to the interface: `prefill_amount`, `prefill_where`, `prefill_date`, `prefill_tags`
- Extract and pass as `prefill` prop to `<ExpenseForm>`

**Modify:** `src/app/(dashboard)/expenses/_components/expense-form.tsx`
- Add optional `prefill?: { amount?: string; where?: string; date?: string; tagIds?: string[] }` to `ExpenseFormProps`
- Use prefill values in `defaultValues` when present (falling back to existing defaults)
- When prefill is present, focus the first empty field instead of the date trigger

## Files Summary

**New (6):**
1. `src/components/ui/drawer.tsx` — ShadCN-generated (vaul wrapper)
2. `src/app/api/tags/recent/route.ts` — recent tags API
3. `src/app/api/tags/recent/__tests__/route.test.ts` — recent tags API tests
4. `src/components/quick-entry/quick-entry-fab.tsx` — FAB + drawer container
5. `src/components/quick-entry/quick-entry-form.tsx` — quick-entry form
6. `src/components/quick-entry/quick-entry-tag-chips.tsx` — tag chip selector

**Modified (5):**
1. `src/hooks/use-hotkeys.ts` — `n` dispatches `OPEN_QUICK_ENTRY_EVENT`
2. `src/components/keyboard-shortcuts-dialog.tsx` — updated shortcut labels
3. `src/app/(dashboard)/layout.tsx` — mount `<QuickEntryFab>`
4. `src/app/(dashboard)/expenses/page.tsx` — accept prefill params
5. `src/app/(dashboard)/expenses/_components/expense-form.tsx` — apply prefill values

## Verification

1. `npm test` — all tests pass (including new recent tags API tests)
2. `npm run type-check` — no TypeScript errors
3. `npm run lint` — no lint errors
4. `npm run build` — successful production build
5. `npm run fallow:audit` — no regressions
6. Manual testing:
   - FAB visible on dashboard, expenses, reports, settlement, activity, recurring pages
   - FAB hidden on /admin pages
   - Click FAB → drawer opens with amount focused
   - Press `n` from any page → drawer opens
   - Enter amount, where, pick a tag chip → Save → toast + drawer closes + expense appears in list
   - Save & add another → toast + form resets + drawer stays open + amount re-focused
   - Ctrl+Enter triggers save & add another
   - "Full form" link navigates to /expenses with values pre-filled
   - Duplicate detection shows non-blocking toast when saving a same-date/amount expense
   - Help dialog (`?`) shows updated shortcuts
