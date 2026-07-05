/**
 * Closed enum for Account.requirements.disabled_reason per Stripe API reference.
 * @see https://docs.stripe.com/api/accounts/object#account_object-requirements-disabled_reason
 * @see https://docs.stripe.com/connect/handling-api-verification
 */
export const STRIPE_ACCOUNT_DISABLED_REASONS = [
  "action_required.requested_capabilities",
  "listed",
  "other",
  "platform_paused",
  "rejected.fraud",
  "rejected.incomplete_verification",
  "rejected.listed",
  "rejected.other",
  "rejected.platform_fraud",
  "rejected.platform_other",
  "rejected.platform_terms_of_service",
  "rejected.terms_of_service",
  "requirements.past_due",
  "requirements.pending_verification",
  "under_review",
] as const;

export type StripeAccountDisabledReason = (typeof STRIPE_ACCOUNT_DISABLED_REASONS)[number];

export function isStripeAccountDisabledReason(value: string): value is StripeAccountDisabledReason {
  return (STRIPE_ACCOUNT_DISABLED_REASONS as readonly string[]).includes(value);
}
