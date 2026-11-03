/**
 * Wording for the identity check outcome, shared by the email and the in-app notice so the two
 * always agree. Neither ever carries a reason code or any detail from the verification provider.
 */

export const KYC_APPROVED_COPY = {
  headline: "Your identity is verified",
  detail: "You can now register for a sale and place bids.",
  actionLabel: "Register for a sale",
} as const;

/**
 * Compliance sign-off required before production: the wording of a declined identity check.
 * Change it here only; the email and the in-app notice both read it.
 */
export const KYC_DECLINED_COPY = {
  headline: "We couldn't verify your identity",
  detail: "The check didn't pass. You can try again, or contact us and we'll help.",
  retryLabel: "Try again",
  contactLabel: "Contact us",
} as const;
