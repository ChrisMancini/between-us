# Settlement Reminders

Months can sit unsettled long after they end — in one real case, May remained open into July because a user hadn't marked themselves as done. The existing amber warning inside the `SettlementStatusCard` widget is too easy to overlook: the widget can be collapsed, and even when expanded the warning blends in as static content. We decided to add a persistent, escalating reminder system that surfaces across the entire app and can't be dismissed.

## Decisions

### 1. Global banner on all pages, not just the dashboard

A reminder banner renders below the top navigation bar on every page in the app. It is full-width and pushes page content down (no overlay). This ensures the nudge is visible regardless of where the user navigates — even if they go straight to expense entry and never visit the dashboard. The banner is not dismissible; it stays until the user takes action.

### 2. Trigger: one week after month end, per-user

The banner appears for a user when both conditions are true:

1. At least 7 days have passed since the end of a month that has expenses
2. That user has **not** marked themselves as done for that month (via the readiness system)

Once a user marks themselves as done, the banner for that month disappears for them — even if the month hasn't been closed yet. The nudge is about getting each person to do their part, not about overall settlement status.

### 3. Personal language with a direct link

The banner addresses the user directly rather than using passive voice. It includes a link to the settlement page so the user can act immediately.

Examples:
- One month: "You haven't marked May as done yet. Go to Settlement →"
- Two months: "You haven't marked April and May as done yet. Go to Settlement →"
- Three or more: "You have 3 months waiting to be closed. Go to Settlement →"

### 4. Three escalation tiers with hardcoded thresholds

The visual urgency increases over time:

| Tier | Trigger | Appearance |
|------|---------|------------|
| Warning | 1 week after month end | Amber background |
| Overdue | 1 month after month end | Red background |
| Critical | 2 months after month end | Red background + pulse animation |

When multiple months are overdue, the banner uses the highest (most urgent) tier among them. Thresholds are hardcoded — no settings UI.

### 5. Reusable escalation tier logic

The escalation tier calculation (given a month/year, determine which tier applies) is extracted into a shared utility. Both the global banner and the `SettlementStatusCard` widget consume the same logic. This avoids duplicating threshold constants and tier-determination code across components.

### 6. Apply escalation tiers to the existing SettlementStatusCard widget

The existing amber "N past months not yet closed" warning inside the `SettlementStatusCard` widget is enhanced to use the same escalation tiers as the global banner. The widget's warning background color and optional pulse animation match the highest-tier unsettled month, consistent with the global banner.

### 7. Collapsed widget indicator

When a widget contains an active notification banner and is collapsed, a colored dot appears on the widget header. The dot color matches the current escalation tier (amber, red, or pulsing red). This uses a mechanism similar to the existing badge number on the Actions widget but communicates severity through color rather than count.

### 8. Responsive design

The global banner must work on mobile browsers. On narrow viewports, the banner text should wrap naturally and remain readable. The link to the settlement page should be easily tappable. The collapsed widget dot should remain visible at all breakpoints.
