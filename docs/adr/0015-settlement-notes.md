# Settlement Notes

Settlements record *that* money changed hands but not *how*. Both users wanted a way to annotate a settlement with payment context (e.g., "Paid via Zelle", "Venmo'd on 7/3") so the history page doubles as a lightweight payment log. We decided to add an optional free-text `note` field directly on the Settlement model.

## Decisions

### 1. Editable without reopening the month

The note can be edited inline on a closed settlement page without triggering the reopen flow. Reopening exists to protect financial accuracy — it snapshots the previous totals, resets readiness, and cancels the associated Action. A text annotation has none of those side effects, so forcing a reopen would add friction with no safety benefit. Either user can edit.

### 2. Note persists through reopen/re-close with no snapshotting

When a month is reopened, financial fields are snapshotted into `previousTotalOwed` / `previousOwedBy` so the re-close dialog can show a before/after delta. The note has no equivalent need — there's no meaningful "diff" to display for free text. The note simply carries forward on the document and pre-fills in the re-close dialog, where it can be kept, edited, or cleared.

### 3. Displayed inside the net result card, not as a separate element

The note appears as a secondary line below the "X owes Y $Z" summary inside the existing `NetResultCard`. Alternatives considered: inside the "Closed" status banner (groups with status but separates from the amount it describes), or as its own card (adds visual weight for a one-liner). The note is context for the payment, so it belongs next to the payment amount.
