import type { LegalEntityKind, LegalEntityStatus } from "@auction/types";
import { organisationStateAllows } from "./organisation-state-policy.js";

export const SELLER_ENTITY_WRITE_STATUSES = new Set<LegalEntityStatus>(["approved", "restricted"]);

export const INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES = new Set<LegalEntityStatus>([
  "rejected",
  "archived",
]);

export const ORGANISATION_UNDER_REVIEW_SUBMIT_REASON =
  "We're still checking this organisation's documents. You can save the work as a draft now and submit it once the organisation is approved.";

export const ORGANISATION_PAYOUTS_PENDING_SUBMIT_REASON =
  "This organisation's payouts aren't set up yet. You can save the work as a draft now and submit it once they are.";

/**
 * Organisation statuses that can prepare drafts but not send them yet, with the reason the
 * seller reads: LAX is still checking the documents, or payouts are still being set up.
 */
const DRAFT_ONLY_REASONS: Partial<Record<LegalEntityStatus, string>> = {
  lead: ORGANISATION_UNDER_REVIEW_SUBMIT_REASON,
  docs_requested: ORGANISATION_UNDER_REVIEW_SUBMIT_REASON,
  docs_received: ORGANISATION_UNDER_REVIEW_SUBMIT_REASON,
  under_review: ORGANISATION_UNDER_REVIEW_SUBMIT_REASON,
  connect_pending: ORGANISATION_PAYOUTS_PENDING_SUBMIT_REASON,
};

export type SellerSubmissionAccess = {
  /** May create and edit drafts. */
  canDraft: boolean;
  /** May send a submission to a specialist. */
  canSubmit: boolean;
  /** Why submitting is not possible yet, in words for the seller. */
  submitBlockedReason: string | null;
};

const BLOCKED_REASON = "This account can't send works for sale in its current state.";

/**
 * What an account may do with submissions, by its verification state. A person can always
 * submit unless their account was closed or rejected. An organisation still under review can
 * prepare drafts but not send them, so its first consignments are ready the day it is approved.
 */
export function sellerSubmissionAccess(entity: {
  kind: LegalEntityKind;
  status: LegalEntityStatus;
}): SellerSubmissionAccess {
  if (entity.kind === "individual") {
    const blocked = INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES.has(entity.status);
    return {
      canDraft: !blocked,
      canSubmit: !blocked,
      submitBlockedReason: blocked ? BLOCKED_REASON : null,
    };
  }
  if (organisationStateAllows(entity.status, "submit")) {
    return { canDraft: true, canSubmit: true, submitBlockedReason: null };
  }
  const draftOnlyReason = DRAFT_ONLY_REASONS[entity.status];
  if (draftOnlyReason) {
    return { canDraft: true, canSubmit: false, submitBlockedReason: draftOnlyReason };
  }
  return { canDraft: false, canSubmit: false, submitBlockedReason: BLOCKED_REASON };
}
