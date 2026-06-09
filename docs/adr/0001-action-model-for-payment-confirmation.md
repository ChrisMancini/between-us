# Action model for payment confirmation

When money needs to change hands outside the app (immediate expenses and monthly settlements), we need to track whether the payment actually happened. We introduced an Action model — a two-party confirmation flow where the debtor marks payment as sent and the creditor confirms receipt.

## Key decisions

**Cancel-and-replace over in-place updates.** When a source expense changes (amount edited, settlement type changed), we cancel the existing Action and create a new one rather than mutating it. This keeps one consistent pattern for all changes and preserves a clear audit trail. The alternative (in-place update) would require an `action_updated` event type and loses history of what the Action was before.

**Auto-cancellation only, no manual dismiss.** Users cannot manually cancel or dismiss an Action — only source changes (expense deleted, amount changed, settlement type changed, month reopened) trigger cancellation. This prevents someone from quietly dismissing a payment obligation. The app is trust-based, but the confirmation flow is the one place where both parties should have to engage.

**Creditor can skip to Confirmed from any state.** Rather than forcing a strict Pending → Paid → Confirmed sequence, the creditor (the person owed money) can confirm receipt at any time — covering the in-person cash scenario where a two-step dance would be unnecessary friction. The debtor cannot unilaterally resolve their own obligation.

**No auto-netting of immediate Actions.** Two opposing immediate Actions (Chris owes Lauren $50, Lauren owes Chris $50) remain independent rather than being automatically netted. Immediate expenses mean "handle this now, one at a time." The partners can each skip-to-confirm if they agree to call it even.

**Delta Actions for already-resolved changes.** When a source changes but the Action is already Paid or Confirmed, we leave the existing Action alone (money already changed hands in the real world) and create a new Action for the difference. Pending Actions are simply cancelled and replaced.

## Considered alternatives

- **General-purpose task system**: Rejected as scope creep. The app is focused on expense tracking; a generic to-do system would compete with dedicated apps.
- **Tying Actions exclusively to expenses**: Rejected because settlement Actions don't map to a single expense. The `sourceType`/`sourceId` discriminator pattern keeps it flexible for future trigger types.
- **Dispute state for unconfirmed payments**: Rejected as too transactional. This is for partners, not a business escrow system. If the creditor didn't receive payment, they simply don't confirm and they talk it out.

## Action model

| Field | Type | Description |
|-------|------|-------------|
| `sourceType` | `"expense"` \| `"settlement"` | What triggered this Action |
| `sourceId` | ObjectId | Reference to the source document |
| `debtorKey` | string | Person who owes money |
| `creditorKey` | string | Person who is owed money |
| `amount` | number | Amount owed in cents |
| `status` | `"pending"` \| `"paid"` \| `"confirmed"` \| `"cancelled"` | Lifecycle state |
| `cancelReason` | string (optional) | Why the Action was cancelled |
| `paidAt` | Date (optional) | When the debtor marked as paid |
| `confirmedAt` | Date (optional) | When the creditor confirmed receipt |
| `cancelledAt` | Date (optional) | When the Action was auto-cancelled |
| `createdAt` / `updatedAt` | timestamps | Standard Mongoose timestamps |

## Triggers

1. **Immediate expense created** — Action for the calculated owed amount (half for split, full for full reimburse)
2. **Month settled** — Action for the net settlement amount (only when > $0)

## Cancellation triggers

| Event | Pending Action | Paid/Confirmed Action |
|-------|---------------|----------------------|
| Expense deleted | Cancel | Leave as-is |
| Amount changed | Cancel, create new | Leave as-is, create delta |
| Immediate → deferred | Cancel | Leave as-is |
| Deferred → immediate | Create new | Create new |
| Month reopened | Cancel | Leave as-is, delta on re-settle |

## Activity events

`action_created`, `action_paid`, `action_confirmed`, `action_cancelled` — logged alongside existing activity types, shown in the Activity widget.

## UI

- **Dashboard**: Actions section at top of right column (badge count on Dashboard nav item)
- **Badge logic**: Counts Actions where it's the current user's turn — debtor sees Pending, creditor sees Paid
- **Notifications**: In-app only (for now); email/push can be layered on later
