import type { LegalEntityKind, LegalEntityStatus } from "@auction/types";

export const SELLER_ENTITY_WRITE_STATUSES = new Set<LegalEntityStatus>(["approved", "restricted"]);

export const INDIVIDUAL_SUBMISSION_BLOCKED_STATUSES = new Set<LegalEntityStatus>([
  "rejected",
  "archived",
]);

/** Organisation statuses that are still being checked by LAX. */
const ORGANISATION_UNDER_REVIEW_STATUSES = new Set<LegalEntityStatus>([
  "lead",
  "docs_requested",
  "docs_received",
  "under_review",
  "connect_pending",
]);

export type SellerSubmissionAccess = {
  /** May create and edit drafts. */
  canDraft: boolean;
  /** May send a submission to a specialist. */
  canSubmit: boolean;
  /** Why submitting is not possible yet, in words for the seller. */
  submitBlockedReason: string | null;
};

export const ORGANISATION_UNDER_REVIEW_SUBMIT_REASON =
  "We're still checking this organisation's documents. You can save the work as a draft now and submit it once the organisation is approved.";

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
  if (SELLER_ENTITY_WRITE_STATUSES.has(entity.status)) {
    return { canDraft: true, canSubmit: true, submitBlockedReason: null };
  }
  if (ORGANISATION_UNDER_REVIEW_STATUSES.has(entity.status)) {
    return {
      canDraft: true,
      canSubmit: false,
      submitBlockedReason: ORGANISATION_UNDER_REVIEW_SUBMIT_REASON,
    };
  }
  return { canDraft: false, canSubmit: false, submitBlockedReason: BLOCKED_REASON };
}
