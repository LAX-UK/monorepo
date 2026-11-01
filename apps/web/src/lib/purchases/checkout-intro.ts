import { resolveCheckoutManualReviewDisplayReason } from "@/lib/checkout/checkout-payment-errors";
import type { ComplianceGateStatus } from "@/lib/data/http/payments.schema";
import type { ManualReviewReason, PaymentStatus } from "@auction/types";
import { type PurchaseState, purchaseState } from "./purchase-progress";

export type CheckoutIntroInput = {
  /** The organisation paying, or null for the person's own purchase. */
  organisationName: string | null;
  paymentComplete: boolean;
  openPaymentStatus: PaymentStatus | null;
  openPaymentReviewReason: ManualReviewReason | null;
  complianceGate: ComplianceGateStatus;
};

type IntroCopy = (forWhom: string) => string;

/** One line per purchase state, so checkout opens with what the purchase page says. */
const INTRO: Partial<Record<PurchaseState, IntroCopy>> & { paid: IntroCopy } = {
  "payment-due": (forWhom) =>
    `Confirm the delivery address and pay${forWhom} by card or UK bank transfer.`,
  "in-review": (forWhom) =>
    `We need to complete some checks on this purchase${forWhom} before you pay. What to do next is below.`,
  "payment-processing": () => "Your payment is being processed. We'll confirm here and by email.",
  paid: () => "This purchase is paid. Follow delivery in Purchases.",
};

/**
 * The checkout's opening line, from the same purchase state as the purchase page and the same
 * review rule as the checkout panel: a purchase held for checks never opens with "pay now".
 */
export function checkoutIntro(input: CheckoutIntroInput): string {
  const reviewReason = resolveCheckoutManualReviewDisplayReason({
    submitted: false,
    submittedReviewReason: null,
    openPaymentStatus: input.openPaymentStatus,
    openPaymentManualReviewReason: input.openPaymentReviewReason,
    preflightComplianceGate: input.complianceGate,
  });
  const state = purchaseState({
    paymentStatus: input.paymentComplete ? "captured" : input.openPaymentStatus,
    reviewReason,
    fulfilment: null,
  });
  const forWhom = input.organisationName ? ` for ${input.organisationName}` : "";
  return (INTRO[state] ?? INTRO.paid)(forWhom);
}
