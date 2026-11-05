import type { LegalEntityStatus } from "@auction/types";
import type { SelfServiceActorKycStatus } from "./self-service-actor-identity-eligibility.js";

/** Why the server refuses to take a payment, beyond who may pay and the compliance holds. */
export type PaymentEligibilityRefusal =
  /** A rejected or archived organisation is read-only: it cannot pay. */
  | "organisation_closed"
  /** A personal buyer pays only once their identity is verified. */
  | "identity_verification_required";

export type PaymentEligibilityFacts = {
  accountKind: "individual" | "organisation";
  accountStatus: LegalEntityStatus;
  /** The payer's identity check; null when it cannot be required (no provider configured). */
  payerKycStatus: SelfServiceActorKycStatus | null;
};

/** Organisation states in which paying is closed. */
export const PAYMENT_CLOSED_ORGANISATION_STATUSES: ReadonlySet<LegalEntityStatus> = new Set([
  "rejected",
  "archived",
]);

/**
 * The one rule for both ways of paying (one invoice or several). Checked on the server, so a
 * page can never offer Pay where the server would refuse.
 */
export function paymentEligibilityRefusal(
  facts: PaymentEligibilityFacts,
): PaymentEligibilityRefusal | null {
  if (
    facts.accountKind === "organisation" &&
    PAYMENT_CLOSED_ORGANISATION_STATUSES.has(facts.accountStatus)
  ) {
    return "organisation_closed";
  }
  if (
    facts.accountKind === "individual" &&
    facts.payerKycStatus !== null &&
    facts.payerKycStatus !== "approved"
  ) {
    return "identity_verification_required";
  }
  return null;
}
