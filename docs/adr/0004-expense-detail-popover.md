# Expense Detail Popover

Expense rows in the Dashboard, Expenses, and Settlement tables show most fields inline but omit Notes and Settlement Type. We need a way to surface the complete expense record without a dedicated detail page.

We chose a click-triggered `Popover` (not the hover `Tooltip` used elsewhere) showing all expense fields, opened by a persistent `Info` icon at the end of each row. The popover stays open until dismissed, which is necessary for reading multi-line notes without holding the cursor still. A hover tooltip would have worked for a single line of text but is too ephemeral for structured, multi-field content.

The trigger icon is always visible (not reveal-on-hover) for discoverability — Lauren is mouse-driven and needs a clear affordance; keyboard navigation also requires a focusable element.

## Considered Options

- **Hover Tooltip** — already used for the Activity Widget's truncated text. Rejected because tooltips dismiss on mouse-out, making them unsuitable for reading longer content.
- **Reveal-on-hover icon** — cleaner visually but less discoverable on first use.
- **No interaction, add a Notes column** — would add clutter to already-dense tables and still wouldn't surface Settlement Type.

## Consequences

All three tables (Dashboard Recent Expenses, Expenses list, Settlement breakdown) use a single shared `ExpenseDetailPopover` component. `SettlementExpenseRow` and the Dashboard's `RecentExpense` shape required `notes`, `splitType`, and `settlementType` fields to be threaded through.
