import "server-only";

import { Action, type IAction } from "@/lib/models/action";
import type { IExpense } from "@/lib/models/expense";
import type { ISettlement } from "@/lib/models/settlement";
import { logActivity } from "@/lib/activity-logger";
import { formatCurrency, formatMonthYear } from "@/lib/utils";
import { getPersons } from "@/lib/persons";

async function getOtherPersonKey(paidByKey: string): Promise<string> {
  const persons = await getPersons();
  if (!persons) throw new Error("Persons not configured");
  return persons[0].key === paidByKey ? persons[1].key : persons[0].key;
}

async function getDisplayName(key: string): Promise<string> {
  const persons = await getPersons();
  if (!persons) return key;
  return persons.find((p) => p.key === key)?.displayName ?? key;
}

function computeOwedAmount(
  amount: number,
  splitType: "split" | "full"
): number {
  return splitType === "split" ? Math.round(amount / 2) : amount;
}

export async function createActionForExpense(
  expense: IExpense,
  otherPersonKey: string,
  actorKey: string
): Promise<IAction | null> {
  if (expense.settlementType !== "immediate") return null;

  const owedAmount = computeOwedAmount(expense.amount, expense.splitType);
  const action = await Action.create({
    sourceType: "expense",
    sourceId: expense._id,
    debtorKey: otherPersonKey,
    creditorKey: expense.paidBy,
    amount: owedAmount,
    status: "pending",
    description: `at ${expense.where}`,
  });

  const debtorName = await getDisplayName(otherPersonKey);
  await logActivity(
    actorKey,
    "action_created",
    `${formatCurrency(owedAmount)} owed by ${debtorName} at ${expense.where}`,
    { actionId: String(action._id), expenseId: String(expense._id) }
  );

  return action;
}

export async function createActionForSettlement(
  settlement: ISettlement,
  actorKey: string
): Promise<IAction | null> {
  if (settlement.totalOwed <= 0) return null;

  const description = `${formatMonthYear(settlement.month, settlement.year)} settlement`;
  const action = await Action.create({
    sourceType: "settlement",
    sourceId: settlement._id,
    debtorKey: settlement.owedBy,
    creditorKey: settlement.owedTo,
    amount: settlement.totalOwed,
    status: "pending",
    description,
  });

  const debtorName = await getDisplayName(settlement.owedBy);
  await logActivity(
    actorKey,
    "action_created",
    `${formatCurrency(settlement.totalOwed)} owed by ${debtorName} — ${description}`,
    { actionId: String(action._id), settlementId: String(settlement._id) }
  );

  return action;
}

export async function cancelPendingActions(
  sourceType: "expense" | "settlement",
  sourceId: unknown,
  cancelReason: string,
  actorKey: string
): Promise<number> {
  const pending = await Action.find({
    sourceType,
    sourceId,
    status: "pending",
  });

  if (pending.length === 0) return 0;

  await Action.updateMany(
    { sourceType, sourceId, status: "pending" },
    { status: "cancelled", cancelReason, cancelledAt: new Date() }
  );

  for (const action of pending) {
    const debtorName = await getDisplayName(action.debtorKey);
    await logActivity(
      actorKey,
      "action_cancelled",
      `cancelled ${formatCurrency(action.amount)} owed by ${debtorName} — ${action.description} (${cancelReason})`,
      { actionId: String(action._id) }
    );
  }

  return pending.length;
}

export async function handleExpenseChange(
  oldExpense: IExpense,
  newValues: Partial<Pick<IExpense, "amount" | "splitType" | "settlementType" | "where">>,
  otherPersonKey: string,
  actorKey: string
): Promise<void> {
  const oldType = oldExpense.settlementType;
  const newType = newValues.settlementType ?? oldType;

  if (oldType === "deferred" && newType === "deferred") return;

  if (oldType === "immediate" && newType === "deferred") {
    await cancelPendingActions(
      "expense",
      oldExpense._id,
      "changed to deferred",
      actorKey
    );
    return;
  }

  if (oldType === "deferred" && newType === "immediate") {
    const mergedExpense = {
      ...oldExpense.toObject(),
      ...newValues,
    } as IExpense;
    await createActionForExpense(mergedExpense, otherPersonKey, actorKey);
    return;
  }

  // immediate → immediate: check for payment-relevant changes
  const newAmount = newValues.amount ?? oldExpense.amount;
  const newSplitType = newValues.splitType ?? oldExpense.splitType;
  const oldOwed = computeOwedAmount(oldExpense.amount, oldExpense.splitType);
  const newOwed = computeOwedAmount(newAmount, newSplitType);

  if (oldOwed === newOwed) return;

  const pendingActions = await Action.find({
    sourceType: "expense",
    sourceId: oldExpense._id,
    status: "pending",
  });

  if (pendingActions.length > 0) {
    await cancelPendingActions(
      "expense",
      oldExpense._id,
      "expense updated",
      actorKey
    );
    const mergedExpense = {
      ...oldExpense.toObject(),
      ...newValues,
    } as IExpense;
    await createActionForExpense(mergedExpense, otherPersonKey, actorKey);
    return;
  }

  // Paid/confirmed actions exist — create a delta action
  const delta = newOwed - oldOwed;
  if (delta === 0) return;

  const where = newValues.where ?? oldExpense.where;
  const debtorKey = delta > 0 ? otherPersonKey : oldExpense.paidBy;
  const creditorKey = delta > 0 ? oldExpense.paidBy : otherPersonKey;
  const absDelta = Math.abs(delta);

  const action = await Action.create({
    sourceType: "expense",
    sourceId: oldExpense._id,
    debtorKey,
    creditorKey,
    amount: absDelta,
    status: "pending",
    description: `at ${where} (adjustment)`,
  });

  const deltaDebtorName = await getDisplayName(debtorKey);
  await logActivity(
    actorKey,
    "action_created",
    `${formatCurrency(absDelta)} adjustment owed by ${deltaDebtorName} at ${where}`,
    { actionId: String(action._id), expenseId: String(oldExpense._id) }
  );
}

export async function handleExpenseDelete(
  expense: IExpense,
  actorKey: string
): Promise<void> {
  if (expense.settlementType !== "immediate") return;
  await cancelPendingActions(
    "expense",
    expense._id,
    "expense deleted",
    actorKey
  );
}

export async function handleSettlementReopen(
  settlementId: unknown,
  actorKey: string
): Promise<void> {
  await cancelPendingActions(
    "settlement",
    settlementId,
    "month reopened",
    actorKey
  );
}

export { getOtherPersonKey };
