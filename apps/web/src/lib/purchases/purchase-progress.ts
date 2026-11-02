import type { LotFulfilmentSnapshot } from "@/lib/data/http/payments.schema";
import { purchaseEnding, purchaseIsToPay } from "@auction/domain";
import type { ManualReviewReason, PaymentStatus } from "@auction/types";

/** The four steps every purchase goes through, in order. */
export const PURCHASE_STEPS = ["won", "payment", "delivery", "delivered"] as const;
export type PurchaseStep = (typeof PURCHASE_STEPS)[number];

/** The views of Purchases, in order. The ids are the page's `?tab=` values. */
export const PURCHASE_TABS = ["to-pay", "in-progress", "completed"] as const;
export type PurchaseTab = (typeof PURCHASE_TABS)[number];

export const PURCHASE_TAB_LABEL: Record<PurchaseTab, string> = {
  "to-pay": "To pay",
  "in-progress": "In progress",
  completed: "Completed",
};

/** Where one purchase stands, as the buyer would say it. */
export type PurchaseState =
  | "payment-due"
  | "in-review"
  | "payment-processing"
  | "choose-delivery"
  | "preparing"
  | "ready-for-collection"
  | "in-transit"
  | "delivered"
  | "collected"
  | "refunded"
  | "cancelled";

export type PurchaseFacts = {
  paymentStatus: PaymentStatus | null;
  /** A payment held for checks; the buyer may have something to provide. */
  reviewReason: ManualReviewReason | null;
  fulfilment: Pick<LotFulfilmentSnapshot, "status" | "fulfilmentMethod" | "collectedAt"> | null;
};

/** The step each state sits on, and the view it belongs to. One row per state. */
const STATE_PLACE: Record<PurchaseState, { step: PurchaseStep; tab: PurchaseTab }> = {
  "payment-due": { step: "payment", tab: "to-pay" },
  "in-review": { step: "payment", tab: "to-pay" },
  "payment-processing": { step: "payment", tab: "in-progress" },
  "choose-delivery": { step: "delivery", tab: "in-progress" },
  preparing: { step: "delivery", tab: "in-progress" },
  "ready-for-collection": { step: "delivery", tab: "in-progress" },
  "in-transit": { step: "delivery", tab: "in-progress" },
  delivered: { step: "delivered", tab: "completed" },
  collected: { step: "delivered", tab: "completed" },
  refunded: { step: "payment", tab: "completed" },
  cancelled: { step: "payment", tab: "completed" },
};

function deliveryState(fulfilment: PurchaseFacts["fulfilment"]): PurchaseState {
  if (!fulfilment) return "choose-delivery";
  if (fulfilment.collectedAt) return "collected";
  switch (fulfilment.status) {
    case "delivered":
      return fulfilment.fulfilmentMethod === "collection" ? "collected" : "delivered";
    case "in_transit":
      return "in-transit";
    case "ready_for_collection":
      return "ready-for-collection";
    default:
      return fulfilment.fulfilmentMethod ? "preparing" : "choose-delivery";
  }
}

/** Where a won lot stands, from its payment and delivery records. */
export function purchaseState(facts: PurchaseFacts): PurchaseState {
  // A refund or cancellation ends the purchase, whatever else the records say.
  const ending = purchaseEnding({
    paymentStatus: facts.paymentStatus,
    fulfilmentStatus: facts.fulfilment?.status,
  });
  if (ending) return ending;
  switch (facts.paymentStatus) {
    case "captured":
      return deliveryState(facts.fulfilment);
    case "authorized":
      return "payment-processing";
    case "requires_manual_review":
      return "in-review";
    default:
      return facts.reviewReason ? "in-review" : "payment-due";
  }
}

/**
 * Whether a won lot is still to pay: it sits in the To pay view (due, or held for checks before
 * it can be paid). A bank transfer on its way is not; nor is a paid, refunded or cancelled lot.
 * Home, the menu counts and the Pay now banner use this, so they always match the To pay view.
 */
export function isToPay(paymentStatus: PaymentStatus | null): boolean {
  return purchaseIsToPay({ paymentStatus });
}

export function purchaseStep(state: PurchaseState): PurchaseStep {
  return STATE_PLACE[state].step;
}

export function purchaseTab(state: PurchaseState): PurchaseTab {
  return STATE_PLACE[state].tab;
}

/** A refund or cancellation ends the purchase early; its steps are not shown as a journey. */
export function purchaseEndedEarly(state: PurchaseState): boolean {
  return state === "refunded" || state === "cancelled";
}

/** "Report a problem" opens once the buyer has paid. */
export function canReportProblem(state: PurchaseState): boolean {
  return !["payment-due", "in-review"].includes(state);
}

export function parsePurchaseTab(raw: string | null | undefined): PurchaseTab | null {
  return (PURCHASE_TABS as readonly string[]).includes(raw ?? "") ? (raw as PurchaseTab) : null;
}

/**
 * The view to open when none is asked for: To pay while anything is due, else the first view
 * that has something in it, else To pay.
 */
export function defaultPurchaseTab(counts: Record<PurchaseTab, number>): PurchaseTab {
  return PURCHASE_TABS.find((tab) => counts[tab] > 0) ?? "to-pay";
}
