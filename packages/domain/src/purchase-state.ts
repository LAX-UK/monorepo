import type { PaymentStatus } from "@auction/types";
import type { PurchaseDeliveryStage } from "./purchase-delivery-stage.js";
import type { PurchaseInvoiceStatus } from "./purchase-invoice-state.js";

/**
 * The one place that says where a won lot stands as a purchase, so the Purchases tabs and badges,
 * the Needs-you tasks, the menu counts, Home's figures and the collection all agree.
 */

/** How a purchase ended before it was settled. */
export type PurchaseEnding = "refunded" | "cancelled";

export type PurchaseStateFacts = {
  /** The lot's latest payment for the account, or `null` before checkout started. */
  paymentStatus: PaymentStatus | null;
  /** The saleroom's fulfilment status for the lot, when a record exists. */
  fulfilmentStatus?: string | null | undefined;
};

/** Payment states that leave a purchase owed (until it ends, see `purchaseEnding`). */
export const OWED_PAYMENT_STATUSES = ["pending", "requires_manual_review"] as const;

/** Whether the purchase was refunded or cancelled; such a purchase is never owed or owned. */
export function purchaseEnding(facts: PurchaseStateFacts): PurchaseEnding | null {
  if (facts.paymentStatus === "refunded") return "refunded";
  if (facts.paymentStatus === "cancelled" || facts.fulfilmentStatus === "cancelled") {
    return "cancelled";
  }
  return null;
}

/**
 * Whether the buyer still has to pay for the lot: no payment yet, or one waiting or held for
 * checks. A payment on its way, a paid, refunded or cancelled purchase is not owed.
 */
export function purchaseIsToPay(facts: PurchaseStateFacts): boolean {
  if (purchaseEnding(facts)) return false;
  const { paymentStatus } = facts;
  return (
    paymentStatus === null ||
    (OWED_PAYMENT_STATUSES as readonly PaymentStatus[]).includes(paymentStatus)
  );
}

/**
 * Whether the account owns the work: it paid for it, and the purchase was not cancelled or
 * refunded. Unpaid and cancelled purchases are not in the collection.
 */
export function purchaseIsOwned(facts: {
  invoice: PurchaseInvoiceStatus;
  deliveryStage: PurchaseDeliveryStage;
}): boolean {
  return facts.invoice === "paid" && facts.deliveryStage !== "cancelled";
}
