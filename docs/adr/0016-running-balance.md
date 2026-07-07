# Running Balance

The settlement page shows one month at a time, so when multiple months are unsettled there's no way to see the cumulative picture. We decided to add a running balance subtitle to the `NetResultCard` that shows the net amount owed across all open months.

## Decisions

### 1. Settlement page only, not the dashboard

The dashboard widget continues to show the current month's amount only. Months rarely slip — Lauren occasionally forgets to mark a month as ready, but it's uncommon. Showing both a current-month figure and a cumulative figure on a small widget card invites confusion, especially when they point in different directions (e.g., Chris owes for the current month but Lauren owes overall).

### 2. Only open and reopened months are included

Closed months represent completed settlements and are excluded. The running balance sums all months that have expenses but no Settlement document with `status: "closed"` — the same set the app already tracks as "unsettled."

### 3. Calculated on-the-fly from expenses, not from stored values

Each open month's settlement is computed by running `calculateSettlement()` against its expenses, then the results are netted across months. Reopened months have a stored `previousTotalOwed`, but expenses may have changed since reopening, so stored values would be stale.

### 4. Subtitle below "[Partner A] owes [Partner B]" in the NetResultCard

The cumulative line appears as secondary text below the directional label — e.g., "Chris owes Lauren $70 across 3 open months." This mirrors how the settlement note sits below the payment summary (ADR 0015). It does not link anywhere; the existing unsettled months alert already provides navigation to individual months.

### 5. Only shown when 2+ months are open

When there's only one open month, the net settlement figure is the running balance — a subtitle repeating the same number adds nothing. The subtitle appears once a second unsettled month exists, regardless of whether the cumulative amount is zero or non-zero.

### 6. Hidden when viewing a closed month

Navigating to a closed month is reviewing history. The running balance describes the current state of unsettled debt, so it's out of context on a historical view.

### 7. Zero cumulative shows "All even across N open months"

Consistent with the existing "All even" language in `NetResultCard` when a single month nets to zero. The subtitle always appears when the 2+ open months condition is met, even if the amounts cancel out.

### 8. Same display for both partners

Both users see the same names-based text ("Chris owes Lauren $70 across 3 open months"), matching the existing `NetResultCard` convention. No "You owe..." personalization.
