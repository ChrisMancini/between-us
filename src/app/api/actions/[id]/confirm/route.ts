import { actionTransitionRoute } from "@/lib/action-transition";
import { formatCurrency } from "@/lib/utils";

export const POST = actionTransitionRoute({
  authorizeField: "creditorKey",
  guardStatus: (status) =>
    status === "confirmed" || status === "cancelled"
      ? `Action is already ${status}`
      : null,
  newStatus: "confirmed",
  timestampField: "confirmedAt",
  activityType: "action_confirmed",
  activityMessage: (action) =>
    `confirmed ${formatCurrency(action.amount)} payment — ${action.description}`,
});
