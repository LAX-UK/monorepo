import type { LegalEntityStatus, UserKycStatus } from "@auction/types";
import { SELLER_ENTITY_WRITE_STATUSES } from "./submission-policy.js";

/**
 * Who the seller is, as far as LAX has checked. A person is checked by identity verification
 * (KYC); an organisation by LAX's review of its documents (KYB), which ends in the same
 * "approved" or "restricted" states that let it submit.
 */
export type SellerIdentityFacts =
  | { kind: "individual"; kycStatus: UserKycStatus | null }
  | { kind: "organisation"; status: LegalEntityStatus };

export function sellerIdentityVerified(facts: SellerIdentityFacts): boolean {
  return facts.kind === "individual"
    ? facts.kycStatus === "approved"
    : SELLER_ENTITY_WRITE_STATUSES.has(facts.status);
}

export const SELLER_IDENTITY_REQUIRED_CODE = "identity_not_verified";
export const SELLER_IDENTITY_REQUIRED_MESSAGE =
  "The seller hasn't verified their identity yet. A specialist can accept the work once they have.";
