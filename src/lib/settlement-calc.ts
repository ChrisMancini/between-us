import type { SerializedTag } from "./models/tag";

export interface SettlementExpenseRow {
  _id: string;
  paidBy: string;
  amount: number; // cents
  splitType: "split" | "full";
  settlementType: "immediate" | "deferred";
  where: string;
  date: string;
  tags: SerializedTag[];
  notes?: string;
}

export interface SettlementBreakdown {
  person1OwesPerson2: number; // cents
  person2OwesPerson1: number; // cents
  netOwedBy: string | "even";
  netAmount: number; // cents, 0 if even
  deferredExpenses: SettlementExpenseRow[];
}

export function calculateSettlement(
  expenses: SettlementExpenseRow[],
  person1Key: string,
  person2Key: string
): SettlementBreakdown {
  let person1OwesPerson2 = 0;
  let person2OwesPerson1 = 0;

  for (const e of expenses) {
    if (e.settlementType !== "deferred") continue;

    const owedAmount =
      e.splitType === "split" ? Math.round(e.amount / 2) : e.amount;

    if (e.paidBy === person1Key) {
      person2OwesPerson1 += owedAmount;
    } else {
      person1OwesPerson2 += owedAmount;
    }
  }

  const net = person2OwesPerson1 - person1OwesPerson2;
  const deferredExpenses = expenses.filter(
    (e) => e.settlementType === "deferred"
  );

  if (net > 0) {
    return {
      person1OwesPerson2,
      person2OwesPerson1,
      netOwedBy: person2Key,
      netAmount: net,
      deferredExpenses,
    };
  } else if (net < 0) {
    return {
      person1OwesPerson2,
      person2OwesPerson1,
      netOwedBy: person1Key,
      netAmount: Math.abs(net),
      deferredExpenses,
    };
  } else {
    return {
      person1OwesPerson2,
      person2OwesPerson1,
      netOwedBy: "even",
      netAmount: 0,
      deferredExpenses,
    };
  }
}
