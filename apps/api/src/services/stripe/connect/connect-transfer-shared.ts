import type Stripe from "stripe";

export const TRANSFER_EVENT_TYPES = new Set([
  "transfer.created",
  "transfer.updated",
  "transfer.reversed",
]);

export function transferStatusFromEvent(eventType: string): "paid" | "reversed" {
  if (eventType === "transfer.reversed") return "reversed";
  return "paid";
}

export function stripeFeeFromTransfer(transfer: Stripe.Transfer): string | undefined {
  const balanceTransaction = transfer.balance_transaction;
  if (!balanceTransaction || typeof balanceTransaction === "string") return undefined;
  const fee = balanceTransaction.fee;
  return typeof fee === "number" ? (fee / 100).toFixed(2) : undefined;
}
