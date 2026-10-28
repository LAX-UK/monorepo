import type { LegalEntityStatus } from "@auction/types";
import { buyerEntityCanBid } from "./buyer-entity-bid-eligibility.js";
import { sellerSubmissionAccess } from "./submission-policy.js";

/**
 * Where an organisation is in its own setup and LAX's review, as members read it. `null` once
 * nothing is left to do.
 */
export type OrganisationSetupState =
  | "documents_requested"
  | "documents_under_review"
  | "payouts_not_set_up"
  | "not_approved";

const SETUP_STATE_BY_STATUS: Record<LegalEntityStatus, OrganisationSetupState | null> = {
  lead: "documents_requested",
  docs_requested: "documents_requested",
  docs_received: "documents_under_review",
  under_review: "documents_under_review",
  connect_pending: "payouts_not_set_up",
  approved: null,
  restricted: null,
  rejected: "not_approved",
  archived: null,
};

/** The organisation's setup state from its status and whether payouts can be made. */
export function organisationSetupState(input: {
  status: LegalEntityStatus;
  payoutsReady: boolean;
}): OrganisationSetupState | null {
  const fromStatus = SETUP_STATE_BY_STATUS[input.status];
  if (fromStatus) return fromStatus;
  if (input.status === "approved" && !input.payoutsReady) return "payouts_not_set_up";
  return null;
}

/**
 * What waits for LAX's approval, from the same rules the server enforces: bidding as the
 * organisation, and sending its submissions (drafts can be prepared meanwhile).
 */
export function organisationApprovalWaits(status: LegalEntityStatus): {
  bidding: boolean;
  submissions: boolean;
} {
  return {
    bidding: !buyerEntityCanBid(status),
    submissions: !sellerSubmissionAccess({ kind: "organisation", status }).canSubmit,
  };
}

/** Whether LAX is checking the organisation's documents (the switcher says "Under review"). */
export function organisationUnderReview(status: LegalEntityStatus): boolean {
  return SETUP_STATE_BY_STATUS[status] === "documents_under_review";
}
