# Running Balance Implementation Plan

## Context

The settlement page shows one month at a time, but when multiple months are unsettled there's no way to see the cumulative picture. Per ADR 0016, we'll add a running balance subtitle to the `NetResultCard` that shows the net amount owed across all open months. This only appears when 2+ months are open, and only when viewing an open month.

## Step 1: Add `calculateRunningBalance` to `src/lib/settlement-calc.ts` (TDD)

Add a new type and pure function alongside `calculateSettlement`:

```typescript
export interface RunningBalance {
  netOwedBy: string | "even";
  netAmount: number;
  monthCount: number;
}

export function calculateRunningBalance(
  breakdowns: SettlementBreakdown[],
  person1Key: string,
  person2Key: string
): RunningBalance
```

The function sums `person1OwesPerson2` and `person2OwesPerson1` across all breakdowns, then nets them using the same direction logic as `calculateSettlement` (lines 44-73). Returns `monthCount: breakdowns.length`.

**Tests first** in `src/lib/__tests__/settlement-calc.test.ts` — new `describe("calculateRunningBalance")` block:
- Two breakdowns same direction → sums amounts
- Two breakdowns opposing directions → nets correctly
- Breakdowns that cancel out → even
- 3+ breakdowns → accumulates correctly
- Empty array → even, monthCount 0
- Single breakdown → passes through, monthCount 1

## Step 2: Compute running balance in settlement page

In `src/app/(dashboard)/settlement/page.tsx`, after the existing `unsettledMonths` derivation (line 97):

1. **Derive `allOpenMonths`** — combine `unsettledMonths` + reopened months + current calendar month (if not closed and not already in the list).

2. **Fetch and compute** — when `allOpenMonths.length >= 2 && !isClosed`, fetch expenses for each open month that isn't the currently viewed month. Use the same `Expense.find` pattern but skip `.populate("tags")` since `calculateSettlement` doesn't use tags. Run `calculateSettlement` on each. Reuse the already-computed `breakdown` for the viewed month if it's in the open set.

3. **Call `calculateRunningBalance`** with all breakdowns. Store as `runningBalance: RunningBalance | null`.

4. **Pass `runningBalance` to `NetResultCard`** as a new optional prop.

## Step 3: Render subtitle in `NetResultCard`

Add optional `runningBalance` prop to the `NetResultCard` function. When present and `monthCount >= 2`, render a subtitle line:

- **Non-zero case** (below the "{payer} owes {receiver}" text, line 449): `"Chris owes Lauren $70.00 across 3 open months"` — uses `text-xs text-muted-foreground`.
- **Zero case** (below the "All settled" text, line 441): `"All even across 3 open months"` — same styling.
- **When viewing a closed month or < 2 open months**: `runningBalance` is `null`, nothing renders.

Resolve display names from the existing `personMap` prop using the same pattern as `payer`/`receiver` on line 419-422.

## Verification

1. Run tests: `npx jest settlement-calc` for unit tests
2. Run type-check: `npm run type-check`
3. Run fallow audit: `npm run fallow:audit`
4. Manual check: start dev server and verify on the settlement page with 0, 1, and 2+ open months

## Files Changed

| File | Change |
|------|--------|
| `src/lib/settlement-calc.ts` | Add `RunningBalance` type + `calculateRunningBalance()` |
| `src/lib/__tests__/settlement-calc.test.ts` | Add test suite for `calculateRunningBalance` |
| `src/app/(dashboard)/settlement/page.tsx` | Derive open months, compute running balance, pass to `NetResultCard`; update `NetResultCard` props + rendering |
