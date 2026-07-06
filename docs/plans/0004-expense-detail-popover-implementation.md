# Expense Detail Popover — Implementation Plan

## Context

Expense rows across three tables (Dashboard Recent Expenses, Expenses list, Settlement breakdown) show core fields inline but omit **Notes** and **Settlement Type**. ADR-0004 chose a click-triggered Popover with an always-visible Info icon to surface the complete record without a detail page.

## Implementation

### 1. Create `ExpenseDetailPopover` component

**New file:** `src/components/expense-detail-popover.tsx`

A single shared component used by all three tables. Accepts a generic props shape with the fields it needs to display:

```ts
interface ExpenseDetailPopoverProps {
  date: string;
  where: string;
  paidBy: string;
  amount: number;
  tags: string;
  splitType: "split" | "full";
  settlementType: "immediate" | "deferred";
  notes?: string;
}
```

The component renders:
- A `Button` (variant `ghost`, size `icon-xs`) with a `lucide-react` `Info` icon as the `PopoverTrigger`
- A `PopoverContent` with a structured layout showing all fields as label/value pairs
- Uses existing `formatCurrency` from `@/lib/utils` and `PersonBadge` for the paidBy display
- Shows "No notes" in muted text when notes is empty

### 2. Add `notes` to `SettlementExpenseRow`

**File:** `src/lib/settlement-calc.ts`

Add `notes?: string` to the `SettlementExpenseRow` interface.

### 3. Thread `notes` through settlement page data mapping

**File:** `src/app/(dashboard)/settlement/page.tsx`

In the `rawExpenses` → `expenses` mapping (~line 111), add `notes: (e.notes as string | undefined)`.

### 4. Expand `RecentExpense` to include popover fields

**File:** `src/app/(dashboard)/dashboard/_components/recent-expenses.tsx`

Add `notes`, `splitType`, `settlementType` to the `RecentExpense` interface.

### 5. Thread new fields through dashboard page data mapping

**File:** `src/app/(dashboard)/dashboard/page.tsx`

In the `recentExpenses` mapping (~line 195-209), add the three new fields from the raw expense documents.

### 6. Add popover trigger to all three tables

Each table gets an Info icon column at the end of each row:

- **Dashboard Recent Expenses** (`recent-expenses.tsx`): Add a narrow column after Amount, render `ExpenseDetailPopover` in each row.
- **Expenses List** (`expense-list.tsx`): Add the Info icon alongside existing Edit/Delete buttons in the action column (visible for all rows, not just editable ones).
- **Settlement Breakdown** (`settlement/page.tsx`, `ExpenseTable`): Add a narrow column after Amount, render `ExpenseDetailPopover` in each row.

## Files Modified

| File | Change |
|------|--------|
| `src/components/expense-detail-popover.tsx` | **New** — shared popover component |
| `src/lib/settlement-calc.ts` | Add `notes?` to `SettlementExpenseRow` |
| `src/app/(dashboard)/settlement/page.tsx` | Thread `notes` in data mapping; add Info column to `ExpenseTable` |
| `src/app/(dashboard)/dashboard/_components/recent-expenses.tsx` | Expand interface; add Info column |
| `src/app/(dashboard)/dashboard/page.tsx` | Thread `notes`, `splitType`, `settlementType` in mapping |
| `src/app/(dashboard)/expenses/_components/expense-list.tsx` | Add Info icon to action area |

## Verification

1. `npm run type-check` — ensure no type errors from the interface changes
2. `npm run lint` — clean lint
3. `npm run fallow:audit` — ensure no dead code, unused exports, new circular dependencies, or complexity regressions (CI will fail otherwise)
4. `npm run dev` — visually verify:
   - Dashboard: Info icon visible on each recent expense row, popover shows all fields
   - Expenses page: Info icon appears for every row (not just owner's)
   - Settlement page: Info icon on deferred and immediate expense rows
   - Popover stays open until dismissed (click outside or press Escape)
   - Notes field shows actual notes or "No notes" placeholder
   - Settlement type shows "Immediate" or "Deferred"
