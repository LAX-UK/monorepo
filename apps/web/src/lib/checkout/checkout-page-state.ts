import type { LotFulfilmentSnapshot } from "@/lib/data/http/payments.server";
import type { MyPaymentRow } from "@/lib/data/http/payments.server";
import type { ManualReviewReason, PaymentStatus } from "@auction/types";

// Only a captured payment (or a post-payment fulfilment state) marks checkout complete.
// `authorized` (bank transfer in flight) must stay an open payment so the page renders
// the "Bank transfer processing" in-flight block instead of "Payment recorded".
const PAID_PAYMENT_STATUSES = new Set<PaymentStatus>(["captured"]);

const POST_PAY_FULFILMENT = new Set([
  "awaiting_release",
  "released",
  "ready_for_collection",
  "in_transit",
  "delivered",
]);

export type CheckoutPagePaymentState = {
  paymentComplete: boolean;
  openPayment: MyPaymentRow | null;
};

/**
 * After a Stripe success redirect, webhook capture may lag — keep the buyer off the pay form
 * with a "confirming" state.
 *
 * IMPORTANT: this only applies to the card rail. A `gb_bank_transfer` checkout redirects to
 * `?payment=success` after merely *displaying* the bank details — the buyer still has to send
 * the wire, so "confirming / do not pay again" would be misleading and could leave the lot
 * unpaid. Bank-transfer progress is surfaced separately once the payment becomes `authorized`.
 */
export function isAwaitingCaptureConfirmation(input: {
  stripeReturnSuccess: boolean;
  paymentComplete: boolean;
  openPaymentStatus: PaymentStatus | null | undefined;
  openPaymentCheckoutRail?: "card" | "gb_bank_transfer" | null;
}): boolean {
  if (!input.stripeReturnSuccess || input.paymentComplete) return false;
  if (input.openPaymentCheckoutRail === "gb_bank_transfer") return false;
  return (
    input.openPaymentStatus == null ||
    input.openPaymentStatus === "pending" ||
    input.openPaymentStatus === "authorized"
  );
}

export type CheckoutViewKind =
  | "complete"
  | "bankTransfer"
  | "confirming"
  | "loadFailed"
  | "redirectFailed"
  | "redirecting"
  | "purchase";

export type CheckoutPurchaseSubView = "manualReview" | "inFlight" | "form";

export type CheckoutView =
  | { kind: "complete" }
  | { kind: "bankTransfer" }
  | { kind: "confirming" }
  | { kind: "loadFailed" }
  | { kind: "redirectFailed" }
  | { kind: "redirecting" }
  | {
      kind: "purchase";
      sub: CheckoutPurchaseSubView;
      manualReviewReason: ManualReviewReason | null;
    };

export type ResolveCheckoutViewInput = {
  paymentComplete: boolean;
  paymentsLoadFailed: boolean;
  bankTransferInstructions: boolean;
  awaitingCaptureConfirmation: boolean;
  redirectFailed: boolean;
  pendingCheckoutUrl: string | null;
  redirectingToStripe: boolean;
  showManualReview: ManualReviewReason | null;
  openPaymentStatus: PaymentStatus | null;
};

export function resolveCheckoutView(input: ResolveCheckoutViewInput): CheckoutView {
  if (input.paymentComplete) {
    return { kind: "complete" };
  }
  if (input.bankTransferInstructions) {
    return { kind: "bankTransfer" };
  }
  if (input.awaitingCaptureConfirmation) {
    return { kind: "confirming" };
  }
  if (input.paymentsLoadFailed) {
    return { kind: "loadFailed" };
  }
  if (input.redirectFailed && input.pendingCheckoutUrl) {
    return { kind: "redirectFailed" };
  }
  if (input.redirectingToStripe) {
    return { kind: "redirecting" };
  }

  if (input.showManualReview) {
    return {
      kind: "purchase",
      sub: "manualReview",
      manualReviewReason: input.showManualReview,
    };
  }
  if (input.openPaymentStatus === "authorized") {
    return { kind: "purchase", sub: "inFlight", manualReviewReason: null };
  }
  return { kind: "purchase", sub: "form", manualReviewReason: null };
}

export function checkoutViewShowsOrderSummary(view: CheckoutView): boolean {
  return view.kind !== "complete" && view.kind !== "redirecting";
}

export function resolveCheckoutPagePaymentState(
  payments: MyPaymentRow[],
  lotId: string,
  fulfilment: LotFulfilmentSnapshot | null,
): CheckoutPagePaymentState {
  const forLot = payments.filter((p) => p.lotId === lotId);
  const captured = forLot.find((p) => PAID_PAYMENT_STATUSES.has(p.status));
  const openPayment =
    forLot.find((p) => ["pending", "requires_manual_review", "authorized"].includes(p.status)) ??
    null;

  const fulfilmentPaid =
    fulfilment != null &&
    fulfilment.status !== "awaiting_payment" &&
    fulfilment.status !== "cancelled" &&
    POST_PAY_FULFILMENT.has(fulfilment.status);

  return {
    paymentComplete: Boolean(captured) || fulfilmentPaid,
    openPayment: captured ? null : openPayment,
  };
}
