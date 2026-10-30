import type { PurchaseState } from "./purchase-progress";

/** Each purchase state as the buyer reads it, in sentence case. */
export const PURCHASE_STATE_LABEL: Record<PurchaseState, string> = {
  "payment-due": "Payment due",
  "in-review": "In review",
  "payment-processing": "Payment processing",
  "choose-delivery": "Choose delivery",
  preparing: "Preparing",
  "ready-for-collection": "Ready to collect",
  "in-transit": "On its way",
  delivered: "Delivered",
  collected: "Collected",
  refunded: "Refunded",
  cancelled: "Cancelled",
};
