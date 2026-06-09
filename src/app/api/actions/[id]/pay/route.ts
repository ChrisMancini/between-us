import { actionTransitionRoute } from "@/lib/action-transition";
import { formatCurrency } from "@/lib/utils";

export const POST = actionTransitionRoute({
  authorizeField: "debtorKey",
  guardStatus: (status) =>
    status !== "pending" ? "Action is not pending" : null,
  newStatus: "paid",
  timestampField: "paidAt",
  activityType: "action_paid",
  activityMessage: (action) =>
    `paid ${formatCurrency(action.amount)} — ${action.description}`,
});
