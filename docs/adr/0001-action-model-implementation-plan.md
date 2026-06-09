# Action Model — Implementation Plan

Companion to [ADR-0001](./0001-action-model-for-payment-confirmation.md).

---

## Phase 1: Action Model + Serialization

**New file: `src/lib/models/action.ts`**

Mongoose schema following the pattern of `activity.ts` and `settlement.ts`:

- `IAction` interface with: `sourceType` ("expense"|"settlement"), `sourceId` (ObjectId), `debtorKey`, `creditorKey`, `amount` (cents), `status` ("pending"|"paid"|"confirmed"|"cancelled"), `cancelReason?`, `description` (denormalized label — "at Publix" or "June 2026 settlement"), `paidAt?`, `confirmedAt?`, `cancelledAt?`, timestamps
- `SerializedAction` type (ObjectIds → strings, Dates → ISO strings)
- Indexes: `{ sourceType: 1, sourceId: 1 }`, `{ status: 1, debtorKey: 1 }`, `{ status: 1, creditorKey: 1 }`, `{ createdAt: -1 }`
- Export: `mongoose.models.Action ?? mongoose.model<IAction>("Action", ActionSchema)`
- `serializeAction()` helper in the same file

The `description` field avoids needing to populate the source document when displaying Actions in the UI.

---

## Phase 2: Activity Event Types

**Modify: `src/lib/models/activity.ts`**

Append four values to `ACTIVITY_ACTIONS`: `"action_created"`, `"action_paid"`, `"action_confirmed"`, `"action_cancelled"`. The `ActivityAction` type auto-updates from the const array.

**Modify: `src/app/(dashboard)/dashboard/_components/activity-widget.tsx`**

Add entries to `ACTION_ICONS` and `ACTION_COLORS`:
- `action_created` → `CircleDollarSign`, teal
- `action_paid` → `Send`, blue
- `action_confirmed` → `CheckCheck`, emerald
- `action_cancelled` → `XCircle`, slate/muted

Also add to the full Activity page icon/color maps (`src/app/(dashboard)/activity/`).

---

## Phase 3: Action Lifecycle Logic

**New file: `src/lib/action-lifecycle.ts`**

Core business logic. All functions accept an `actorKey` for activity logging and wrap DB calls in try/catch (fire-and-forget, matching `logActivity` pattern).

### `createActionForExpense(expense, otherPersonKey, actorKey)`
- Only for `settlementType === "immediate"`
- Owed amount: `splitType === "split" ? Math.round(amount / 2) : amount`
- `debtorKey` = `otherPersonKey`, `creditorKey` = `expense.paidBy`
- `description` = `"at ${expense.where}"`
- Logs `action_created`

### `createActionForSettlement(settlement, actorKey)`
- Only when `totalOwed > 0`
- `debtorKey` = `settlement.owedBy`, `creditorKey` = `settlement.owedTo`
- `description` = `"{monthName} {year} settlement"`
- Logs `action_created`

### `cancelPendingActions(sourceType, sourceId, cancelReason, actorKey)`
- `Action.updateMany({ sourceType, sourceId, status: "pending" }, ...)`
- Logs `action_cancelled` for each cancelled Action

### `handleExpenseChange(oldExpense, newValues, otherPersonKey, actorKey)`

The cancel-and-replace / delta logic. Decision tree:

| Old settlementType | New settlementType | Behaviour |
|---|---|---|
| deferred | deferred | No-op |
| immediate | deferred | Cancel pending Actions |
| deferred | immediate | Create new Action |
| immediate | immediate | See below |

For immediate→immediate with payment-relevant changes (amount, splitType changed):

- **Pending Actions**: cancel and replace with new Action (new values)
- **Paid/Confirmed Actions**: leave alone, create delta Action for the difference
  - delta > 0 → same direction
  - delta < 0 → reversed debtor/creditor, abs(delta)
  - delta = 0 → no-op
- `paidBy` cannot change via the update route (omitted from `expenseUpdateApiSchema`), which simplifies this

### `handleExpenseDelete(expense, actorKey)`
- If immediate: cancel pending Actions (reason: "expense deleted")
- If deferred: no-op

### `handleSettlementReopen(settlementId, actorKey)`
- Cancel pending Actions for this settlement source (reason: "month reopened")

### Helper: `getOtherPersonKey(paidByKey)`
- Calls `getPersons()`, returns the key that isn't `paidByKey`

**Reuses:** `formatCurrency` from `utils.ts`, `logActivity` from `activity-logger.ts`, `getPersons` from `persons.ts`

---

## Phase 4: Action API Routes

**New file: `src/lib/validations/action.ts`**
- `actionQuerySchema`: Zod schema for GET params (status filter, limit)

**New file: `src/app/api/actions/route.ts`** — `GET /api/actions`
- `withAuth` wrapper
- Default: active Actions (pending + paid) where user is debtor or creditor
- Optional status filter, sorted by `createdAt: -1`, limit 20

**New file: `src/app/api/actions/count/route.ts`** — `GET /api/actions/count`
- Returns `{ count }` of Actions where it's the user's turn:
  - `(debtorKey === me AND status === "pending") OR (creditorKey === me AND status === "paid")`
- Used by nav badge; must be fast (indexed queries)

**New file: `src/app/api/actions/[id]/pay/route.ts`** — `POST /api/actions/:id/pay`
- `withAuth`, validate ObjectId, find Action
- 403 if user isn't debtor; 422 if status !== "pending"
- Set `status: "paid"`, `paidAt: new Date()`
- Log `action_paid`

**New file: `src/app/api/actions/[id]/confirm/route.ts`** — `POST /api/actions/:id/confirm`
- `withAuth`, validate ObjectId, find Action
- 403 if user isn't creditor; 422 if already confirmed or cancelled
- Allows both pending→confirmed (skip-to-confirm) and paid→confirmed
- Set `status: "confirmed"`, `confirmedAt: new Date()`
- Log `action_confirmed`

---

## Phase 5: Integration — Expense Routes

**Modify: `src/app/api/expenses/route.ts`** (POST)
- After expense creation + activity log, if `settlementType === "immediate"`:
  - Call `createActionForExpense(expense, otherPersonKey, session.user.paidByKey)`

**Modify: `src/app/api/expenses/[id]/route.ts`** (PUT)
- Capture `existing` state before update (already available as `existing` variable)
- After update + activity log, call `handleExpenseChange(existing, newValues, otherPersonKey, actorKey)`

**Modify: `src/app/api/expenses/[id]/route.ts`** (DELETE)
- After delete, call `handleExpenseDelete(existing, session.user.paidByKey)`

**Modify: `src/app/api/expenses/import/route.ts`** and **`src/app/api/recurring/[id]/apply/route.ts`**
- After bulk creation, call `createActionForExpense` for each immediate expense

---

## Phase 6: Integration — Settlement Routes

**Modify: `src/app/api/settlement/route.ts`** (POST — close month)
- After settlement creation + activity log, if `breakdown.netAmount > 0`:
  - Call `createActionForSettlement(settlement, session.user.paidByKey)`
- On re-close: always create new Action for the new total. Old paid/confirmed Actions from the previous close remain as historical records.

**Modify: `src/app/api/settlement/reopen/route.ts`** (POST)
- After reopen, call `handleSettlementReopen(existing._id, session.user.paidByKey)`

---

## Phase 7: Dashboard UI — Actions Widget

**New file: `src/app/(dashboard)/dashboard/_components/actions-widget.tsx`**

Client component following the card pattern from `activity-widget.tsx`:
- Header: "Actions" (uppercase, `text-primary/70`)
- Each Action: direction (you owe / you're owed), amount, description, status
- Buttons: "Mark Paid" (debtor on pending) / "Confirm Receipt" (creditor on paid or pending)
- Creditor always sees "Confirm" (skip-to-confirm from any non-terminal state)
- Empty state: "No pending actions."
- Calls `/api/actions/:id/pay` or `/confirm`, then `router.refresh()`

**Modify: `src/app/(dashboard)/dashboard/page.tsx`**
- Add Action query to `Promise.all` block: fetch active Actions for current user
- Place `ActionsWidget` at top of right column (before `SettlementStatusCard`)

---

## Phase 8: Nav Badge

**New file: `src/hooks/use-action-count.ts`**
- Fetches `GET /api/actions/count` on mount and every 30s (matching `use-activity-poll.ts` pattern)
- Respects tab visibility
- Returns `{ count }`

**Modify: `src/components/nav-links.tsx`**
- Call `useActionCount()`
- Show numeric badge pill next to "Dashboard" when count > 0

---

## Verification

### Coverage requirements

Jest collects coverage from `src/lib/**/*.ts` and `src/app/api/**/route.ts` with an **80% threshold** on branches, functions, lines, and statements. The following new files fall within those globs and must have tests:

| File | Test file | Key coverage areas |
|---|---|---|
| `src/lib/action-lifecycle.ts` | `src/lib/__tests__/action-lifecycle.test.ts` | See detailed list below |
| `src/app/api/actions/route.ts` | `src/app/api/actions/__tests__/route.test.ts` | GET with/without status filter, default limit, auth guard |
| `src/app/api/actions/count/route.ts` | `src/app/api/actions/count/__tests__/route.test.ts` | Returns correct "your turn" count for debtor (pending) and creditor (paid) |
| `src/app/api/actions/[id]/pay/route.ts` | `src/app/api/actions/[id]/pay/__tests__/route.test.ts` | 403 non-debtor, 422 non-pending, happy path sets status+paidAt |
| `src/app/api/actions/[id]/confirm/route.ts` | `src/app/api/actions/[id]/confirm/__tests__/route.test.ts` | 403 non-creditor, 422 already confirmed/cancelled, paid→confirmed, pending→confirmed (skip-to-confirm) |

**Excluded from coverage** (no tests required): `src/lib/models/action.ts` (excluded by `!src/lib/models/**`), `src/lib/validations/action.ts` (excluded by `!src/lib/validations/**`).

### `action-lifecycle.ts` test plan

This file has the most branching logic. Tests must cover:

- **`createActionForExpense`**: split vs. full amount calculation, sets correct debtor/creditor, skips when settlementType is deferred
- **`createActionForSettlement`**: sets description to "{monthName} {year} settlement", skips when totalOwed is 0
- **`cancelPendingActions`**: cancels only pending Actions (leaves paid/confirmed untouched), sets cancelReason
- **`handleExpenseChange`** — the full decision matrix:
  - deferred → deferred: no-op
  - immediate → deferred: cancels pending Actions
  - deferred → immediate: creates new Action
  - immediate → immediate (pending, amount changed): cancel and replace
  - immediate → immediate (paid/confirmed, amount increased): delta Action same direction
  - immediate → immediate (paid/confirmed, amount decreased): delta Action reversed direction
  - immediate → immediate (paid/confirmed, amount unchanged): no-op
- **`handleExpenseDelete`**: cancels pending for immediate, no-op for deferred
- **`handleSettlementReopen`**: cancels pending Actions for settlement source

### Manual testing

- Create immediate expense → Action appears on partner's dashboard
- Partner marks paid → creditor sees "Confirm"
- Creditor confirms → Action resolved
- Creditor skip-to-confirm from pending → works
- Edit immediate expense amount → pending Action cancelled, new one created
- Delete immediate expense → pending Action cancelled
- Close month with net > $0 → settlement Action created
- Reopen month → pending settlement Action cancelled
- Nav badge reflects "your turn" count

### CI gate

`npm run type-check && npm run lint && npx jest --coverage`
