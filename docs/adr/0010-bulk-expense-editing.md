# Bulk Expense Editing

The expense list supports editing one expense at a time via a dialog. When users need to recategorize, reclassify, or retype many expenses at once — especially early on while establishing tagging conventions — this is tedious. We decided to add a bulk edit mode to the main expenses page that lets users select multiple expenses and change tags, split type, or settlement type in a single operation.

## Decisions

### 1. Main expenses page only, not other list views

Expenses appear in five places: the main expenses page, the dashboard widget, the settlement page, reports, and the annual report. Bulk edit lives only on the main expenses page — the other views are read-only summaries where adding selection checkboxes would clutter their purpose. The main page is where users go to manage expenses and already has edit/delete actions per row.

### 2. Toggle mode with a "Select" button, not a separate page

A "Select" button in the toolbar reveals checkboxes on each row. A sticky action bar appears between the filters and the table once the user is in bulk edit mode. This keeps the user in context with their current filters and view (single month or "All"). A "Cancel" button and the Escape key exit bulk edit mode and clear selections.

### 3. Three editable fields with partial application

The bulk-editable fields are:

- **Tags** — with a mode toggle: Replace all / Add to existing / Remove from existing
- **Split type** — 50/50 or Full
- **Settlement type** — Immediate or Deferred

Each field defaults to "no change." Only fields the user explicitly sets are applied. Unchanged fields are left alone on every selected expense.

### 4. Selection includes all visible rows; eligibility is per-field at apply time

Checkboxes appear on every visible expense, including settled expenses and expenses paid by the other person. Select-all selects all visible/filtered expenses. Eligibility is enforced per-field when the operation is applied:

| Field           | Settled expense | Other person's expense |
|-----------------|-----------------|------------------------|
| Tags            | Allowed         | Allowed                |
| Split type      | Blocked         | Blocked                |
| Settlement type | Blocked         | Blocked                |

Tags are collaborative — either user can recategorize any expense. Split type and settlement type are the payer's prerogative and cannot be changed on settled expenses.

When a field cannot be applied to some selected expenses, those expenses are skipped for that field. The operation applies to all eligible expenses and reports what was skipped.

### 5. Confirmation dialog with results summary

Clicking "Apply" opens a confirmation dialog summarizing the pending changes and expected skips (e.g., "Change split type to Full on 7 expenses. 2 will be skipped — settled."). After the user confirms and the API responds, the dialog transitions to a results summary showing what was updated and what was skipped. A "Done" button closes the dialog and exits bulk edit mode. This avoids the problem of a toast closing too quickly for the user to review the results.

### 6. Side effects fire per expense

Changing settlement type from "deferred" to "immediate" creates an action item for the other person — the same side effect as individual editing. In bulk mode, this fires for each affected expense. The confirmation dialog warns the user when this will happen (e.g., "This will create 10 action items for Lauren").

### 7. One activity log entry per expense, annotated as bulk edit

Each changed expense gets its own activity log entry, consistent with individual edits. The activity description includes a note that the change was part of a bulk edit (e.g., "Chris changed split type to Full (bulk edit)") so the activity feed remains a reliable per-expense audit trail while also explaining why many changes appeared at once.

### 8. No undo — confirmation dialog is sufficient protection

Building bulk undo would add significant complexity. The confirmation dialog with a change summary provides adequate protection, and individual expenses can still be corrected after the fact. This is a two-person trust-based app, not a multi-tenant system where destructive actions need rollback.
