import type { LegalEntityStatus } from "@auction/types";
import { organisationStateAllows } from "./organisation-state-policy.js";
import type { SelfServiceActorKycStatus } from "./self-service-actor-identity-eligibility.js";

/** Why the server refuses to take a payment at all: the account is closed. */
export type PaymentEligibilityRefusal = "organisation_closed";

/**
 * Why an invoice is held: it stays owed but cannot be paid yet, and the buyer is told what
 * happens next instead of seeing Pay.
 */
export type PaymentEligibilityHold =
  /** A personal buyer pays once their identity is verified; the hold shows how to verify. */
  | "identity_verification_required"
  /** An organisation LAX is still checking (documents asked for or under review). */
  | "organisation_under_review";

export type PaymentEligibility =
  | { kind: "payable" }
  | { kind: "held"; reason: PaymentEligibilityHold }
  | { kind: "refused"; reason: PaymentEligibilityRefusal };

export type PaymentEligibilityFacts = {
  accountKind: "individual" | "organisation";
  accountStatus: LegalEntityStatus;
  /** The payer's identity check; null when it cannot be required (no provider configured). */
  payerKycStatus: SelfServiceActorKycStatus | null;
};

/** Organisation states in which paying is closed for good. */
export const PAYMENT_CLOSED_ORGANISATION_STATUSES: ReadonlySet<LegalEntityStatus> = new Set([
  "rejected",
  "archived",
]);

/**
 * The one rule for both ways of paying (one invoice or several), checked on the server so a page
 * can never offer Pay where the server would not take it:
 * - a rejected or archived organisation is refused;
 * - an organisation whose state does not yet allow paying (documents asked for, under review) is
 *   held until LAX has checked it;
 * - a personal buyer whose identity is not verified is held until they verify it.
 */
export function paymentEligibility(facts: PaymentEligibilityFacts): PaymentEligibility {
  if (facts.accountKind === "organisation") {
    if (PAYMENT_CLOSED_ORGANISATION_STATUSES.has(facts.accountStatus)) {
      return { kind: "refused", reason: "organisation_closed" };
    }
    if (!organisationStateAllows(facts.accountStatus, "pay")) {
      return { kind: "held", reason: "organisation_under_review" };
    }
    return { kind: "payable" };
  }
  if (facts.payerKycStatus !== null && facts.payerKycStatus !== "approved") {
    return { kind: "held", reason: "identity_verification_required" };
  }
  return { kind: "payable" };
}
