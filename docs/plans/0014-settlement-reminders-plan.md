# Settlement Reminders — Implementation Plan

## Context

Months can sit unsettled long after they end — in one real case, May remained open into July because a user hadn't marked themselves as done. The existing amber warning inside the `SettlementStatusCard` widget is too passive. This feature adds a persistent, escalating reminder system with three pieces: a reusable escalation tier utility, a global banner on all pages, and enhanced widget behavior.

Spec: `docs/adr/0014-settlement-reminders.md`

## Slices

### 1. Escalation tier utility

**New file:** `src/lib/escalation-tiers.ts`

Export a pure function `getEscalationTier(monthYear, now?)` that returns `"warning" | "overdue" | "critical" | null` based on how long ago the month ended:

- `null` — less than 7 days past month end
- `"warning"` — 7+ days past month end
- `"overdue"` — 1 calendar month past month end
- `"critical"` — 2 calendar months past month end

"Month end" = first day of the next month in UTC (e.g., May 2026 ends at `Date.UTC(2026, 5, 1)`). The "1 month" and "2 month" thresholds use calendar month offsets (`Date.UTC(year, month + 1, 1)` and `Date.UTC(year, month + 2, 1)`), not fixed day counts.

Also export:

- `getHighestEscalationTier(months[], now?)` — returns the most severe tier across an array of months
- `ESCALATION_TIER_STYLES` — a `Record<EscalationTier, { border, bg, text, icon, dot, pulse }>` mapping each tier to Tailwind classes. The `"warning"` tier reuses the exact amber classes already in `settlement-status-card.tsx:75-76`. The `"overdue"` and `"critical"` tiers use the red equivalent. `"critical"` sets `pulse: true`.

**Tests:** `src/lib/__tests__/escalation-tiers.test.ts` — cover all threshold boundaries, year rollover (December evaluated in February), empty array, and highest-tier selection.

### 2. Unsettled months query function

**New file:** `src/lib/unsettled-months.ts`

Export `getUnsettledMonthsForUser(userKey: string): Promise<MonthYear[]>` that returns past months where:
1. At least one expense exists in that month
2. No settlement with `status: "closed"` exists
3. The given user's key is NOT in that month's `MonthReadiness.doneBy` array

This combines the expense aggregation + closed-settlement filtering already done inline in `dashboard/page.tsx:80-192` with a new `MonthReadiness` query. Runs three DB queries:
1. `Expense.aggregate` for distinct past `{month, year}` pairs (same pattern as `dashboard/page.tsx:80-94`)
2. `Settlement.find({ status: "closed" })` for closed months (same as `dashboard/page.tsx:97-101`)
3. `MonthReadiness.find(...)` for readiness records of the unsettled months — batched into one query, not per-month

Filter in JS: remove closed months, then remove months where the user appears in `doneBy`. Return sorted chronologically (oldest first).

The dashboard page's existing inline queries are left as-is for now — they compute more than just unsettled months and are part of a 9-query `Promise.all`. Refactoring them to use this function is a separate cleanup task.

### 3. Dashboard page — pass month details instead of count

**Modify:** `src/app/(dashboard)/dashboard/page.tsx`

Change the unsettled months computation (lines 186-192) from producing `unsettledMonthCount` (integer) to `unsettledMonths` (array of `{ month, year }`):

```ts
// Before:
const unsettledMonthCount = expenseMonths.map(...).filter(...).length;

// After:
const unsettledMonths = expenseMonths
  .map((e) => e._id)
  .filter((m) => !closedSet.has(`${m.year}-${m.month}`))
  .sort((a, b) => a.year - b.year || a.month - b.month);
```

Update `settlementProps` to pass `unsettledMonths` instead of `unsettledMonthCount`.

**Modify:** `src/app/(dashboard)/dashboard/_components/dashboard-widget-column.tsx`

Update `SettlementProps` interface: replace `unsettledMonthCount: number` with `unsettledMonths: Array<{ month: number; year: number }>`.

### 4. Enhanced SettlementStatusCard with escalation tiers

**Modify:** `src/app/(dashboard)/dashboard/_components/settlement-status-card.tsx`

Update `SettlementStatusCardProps` to accept `unsettledMonths` instead of `unsettledMonthCount`.

Import `getHighestEscalationTier` and `ESCALATION_TIER_STYLES` from `@/lib/escalation-tiers`. Compute the tier from the months array. Replace the hardcoded amber styling (lines 74-82) with tier-driven classes from `ESCALATION_TIER_STYLES`. Apply `animate-pulse` when the style's `pulse` is true. Continue using `unsettledMonths.length` for the count display.

Fall back to the existing amber styling if months exist but none have crossed the 7-day threshold (tier is `null`).

### 5. Collapsed widget indicator dot

**Modify:** `src/app/(dashboard)/dashboard/_components/dashboard-widget.tsx`

Add two optional props to `DashboardWidgetProps`:
- `indicatorDot?: string` — Tailwind color class for the dot (e.g., `"bg-amber-500"`)
- `indicatorPulse?: boolean` — whether to apply `animate-pulse`

Render the dot in the header bar, adjacent to the existing badge, only when `collapsed` is true:

```tsx
{collapsed && indicatorDot && (
  <span className={cn("ml-2 inline-block h-2.5 w-2.5 rounded-full", indicatorDot, indicatorPulse && "animate-pulse")} />
)}
```

Import `cn` from `@/lib/utils` (already used throughout the codebase).

**Modify:** `src/app/(dashboard)/dashboard/_components/dashboard-widget-column.tsx`

Compute the settlement escalation tier using `getHighestEscalationTier(settlementProps.unsettledMonths)`. Pass `indicatorDot` and `indicatorPulse` to `DashboardWidget` when `widgetId === "settlement-status"` and a tier is active.

### 6. Global settlement reminder banner

**New file:** `src/components/settlement-reminder-banner.tsx`

A server component (no `"use client"`) that renders a full-width banner below the nav bar. Props: `months: MonthYear[]` (already filtered to months where the current user hasn't marked done).

The component:
- Computes the highest escalation tier via `getHighestEscalationTier(months)`
- Returns `null` if tier is `null` (no month has crossed the 7-day threshold)
- Applies tier-driven styling from `ESCALATION_TIER_STYLES`
- Renders an `AlertTriangle` icon, message text, and a "Go to Settlement" link

**Banner text rules:**
- 1 month: "You haven't marked May as done yet."
- 2 months: "You haven't marked April and May as done yet."
- 3+ months: "You have N months waiting to be closed."

**Link target:**
- 1-2 months: `/settlement?month={oldest.month}&year={oldest.year}`
- 3+ months: `/settlement`

**Layout:**
- `border-b` separating it from content below
- `max-w-screen-xl mx-auto` matching header/main width
- `px-6 py-3` for comfortable padding
- `animate-pulse` on the container when critical tier
- Responsive: text wraps naturally on mobile, link uses `whitespace-nowrap`, icon uses `shrink-0`

**Modify:** `src/app/(dashboard)/layout.tsx`

Add the data query and banner between `</header>` and `<main>`:

```tsx
import { getUnsettledMonthsForUser } from "@/lib/unsettled-months";
import { SettlementReminderBanner } from "@/components/settlement-reminder-banner";

// After existing auth + persons checks:
const unsettledMonthsForUser = await getUnsettledMonthsForUser(session.user.paidByKey);

// In JSX, between </header> and <main>:
<SettlementReminderBanner months={unsettledMonthsForUser} />
```

The banner component handles returning `null` when there are no months or none have crossed the threshold.

**Stale banner after marking done:** The `readiness-status.tsx` component already calls `router.refresh()` after toggling readiness, which re-renders the server layout. Verify this during testing.

## Month name formatting

Use a small helper (inline or in the escalation tiers file) to format `{ month, year }` as a readable name. Use `Intl.DateTimeFormat` with `{ month: "long" }` for month names (e.g., "May") and append the year only if it differs from the current year (e.g., "December 2025" vs. just "June").

## Verification

1. `npm run type-check` — no TypeScript errors
2. `npm run lint` — no ESLint warnings
3. Run existing tests: `npx jest --coverage` — no regressions
4. New unit tests for `escalation-tiers.ts` pass
5. `npm run dev` — verify:
   - Dashboard with no unsettled months: no banner, no dot
   - Dashboard with a month 8 days past: amber banner, amber widget warning, amber dot when collapsed
   - Dashboard with a month 5 weeks past: red banner, red widget warning, red dot when collapsed
   - Dashboard with a month 2+ months past: red+pulse banner, red+pulse widget warning, pulsing red dot
   - Mark yourself as done for that month: banner disappears on next navigation
   - Multiple unsettled months at different tiers: banner uses highest tier
   - Mobile viewport: banner text wraps readably, link is tappable
6. `npm run fallow:audit` — no complexity regressions or dead code
