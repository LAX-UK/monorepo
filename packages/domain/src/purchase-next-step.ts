import type { PaymentStatus } from "@auction/types";

/** Where a won lot's delivery stands (`lot_fulfilment.status`). */
export type PurchaseFulfilmentStatus =
  | "awaiting_payment"
  | "awaiting_release"
  | "released"
  | "ready_for_collection"
  | "in_transit"
  | "delivered"
  | "cancelled";

export type PurchaseNextStepFacts = {
  /** The lot's latest payment, or `null` before checkout started. */
  paymentStatus: PaymentStatus | null;
  fulfilment: {
    status: PurchaseFulfilmentStatus;
    method: "collection" | "shipping" | null;
    collectedAt: Date | null;
  } | null;
  /** A courier quote LAX prepared and the buyer has not answered yet. */
  shippingQuote: "ready" | null;
};

/**
 * The one thing the buyer does next for a won lot, or `null` while it is with LAX or done:
 * - `pay`: nothing paid yet, or the payment is held for checks (the "To pay" view);
 * - `choose_delivery`: paid, and no delivery method chosen;
 * - `quote_ready`: a courier quote waits for an answer;
 * - `book_collection`: ready to collect and not collected.
 */
export type PurchaseNextStep = "pay" | "choose_delivery" | "quote_ready" | "book_collection";

/** Payment states that leave the lot still to pay. */
const TO_PAY: ReadonlySet<PaymentStatus | null> = new Set([
  null,
  "pending",
  "cancelled",
  "requires_manual_review",
]);

/** Delivery states that are past the choice: on its way, done or stopped. */
const PAST_CHOICE: ReadonlySet<PurchaseFulfilmentStatus> = new Set([
  "ready_for_collection",
  "in_transit",
  "delivered",
  "cancelled",
]);

export function purchaseNextStep(facts: PurchaseNextStepFacts): PurchaseNextStep | null {
  if (TO_PAY.has(facts.paymentStatus)) return "pay";
  if (facts.paymentStatus !== "captured") return null;
  const { fulfilment } = facts;
  if (fulfilment?.status === "ready_for_collection" && !fulfilment.collectedAt) {
    return "book_collection";
  }
  if (fulfilment && PAST_CHOICE.has(fulfilment.status)) return null;
  if (facts.shippingQuote === "ready") return "quote_ready";
  return fulfilment?.method ? null : "choose_delivery";
}
