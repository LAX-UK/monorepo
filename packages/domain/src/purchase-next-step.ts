import type { PaymentStatus } from "@auction/types";
import { purchaseEnding, purchaseIsToPay } from "./purchase-state.js";

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

/** Delivery states that are past the choice: on its way, done or stopped. */
const PAST_CHOICE: ReadonlySet<PurchaseFulfilmentStatus> = new Set([
  "ready_for_collection",
  "in_transit",
  "delivered",
  "cancelled",
]);

export function purchaseNextStep(facts: PurchaseNextStepFacts): PurchaseNextStep | null {
  const state = { paymentStatus: facts.paymentStatus, fulfilmentStatus: facts.fulfilment?.status };
  if (purchaseEnding(state)) return null;
  if (purchaseIsToPay(state)) return "pay";
  if (facts.paymentStatus !== "captured") return null;
  const { fulfilment } = facts;
  if (fulfilment?.status === "ready_for_collection" && !fulfilment.collectedAt) {
    return "book_collection";
  }
  if (fulfilment && PAST_CHOICE.has(fulfilment.status)) return null;
  if (facts.shippingQuote === "ready") return "quote_ready";
  return fulfilment?.method ? null : "choose_delivery";
}
