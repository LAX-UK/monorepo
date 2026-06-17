import type { LotFulfilmentSnapshot } from "@/lib/data/http/payments.server";
import type { MyPaymentRow } from "@/lib/data/http/payments.server";
import type { PaymentStatus } from "@auction/types";

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
