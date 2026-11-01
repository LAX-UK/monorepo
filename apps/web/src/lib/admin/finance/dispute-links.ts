/** The case page of a dispute, by its case ID. */
export function disputeCaseHref(caseId: string): string {
  return `/admin/disputes/${encodeURIComponent(caseId)}`;
}

/** The dispute in the Stripe dashboard, where evidence is prepared and submitted. */
export function disputeStripeHref(stripeDisputeId: string): string {
  return `https://dashboard.stripe.com/disputes/${encodeURIComponent(stripeDisputeId)}`;
}
