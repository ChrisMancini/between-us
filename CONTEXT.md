# Between Us

A shared expense tracker for two partners who share household expenses but maintain separate bank accounts.

## Language

**Finalize**:
When a user signals they have finished entering all their expenses for a given month. Both users must finalize before the month can be settled. Finalizing is reversible.
_Avoid_: Close (for this step), mark as done

**Settle (Settlement)**:
The act of locking a month and calculating the net amount owed between the two users. Once settled, the month is locked and no new expenses can be added without reopening.
_Avoid_: Close the month

**Immediate Expense**:
An expense expected to be paid back right away, outside the app. Excluded from the monthly settlement calculation.

**Deferred Expense**:
An expense accumulated and resolved as part of the monthly settlement.

**Action**:
A lightweight confirmation flow triggered when money needs to change hands outside the app. The debtor pays externally (cash, Venmo, Zelle, etc.), marks the Action as paid, and the creditor confirms receipt. The creditor may skip straight to confirmed from any state. The debtor cannot unilaterally resolve an Action — only the creditor's confirmation closes it. Actions are created automatically, never manually. Actions are cancelled automatically, never manually.
_Avoid_: Task, to-do, payment request

**Debtor**:
The person who owes money in an Action.

**Creditor**:
The person who is owed money in an Action. Always the person who paid the expense (for immediate expense Actions) or the person the settlement says is owed (for settlement Actions).
_Avoid_: Payee, receiver

**Shortcuts**:
Navigation links on the Dashboard for common tasks (log expense, view reports, settlement). Formerly "Quick Actions" — renamed to avoid collision with Action.
_Avoid_: Quick Actions
