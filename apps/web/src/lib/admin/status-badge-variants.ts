import type {
  ArtistStatus,
  ItemSubmissionStatus,
  LotStatus,
  PaymentStatus,
  PayoutStatus,
  SaleStatus,
} from "@auction/types";

/** Matches `StatusBadge` `variant` prop in `@auction/ui`. */
export type AdminStatusBadgeVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "live";

// ---------------------------------------------------------------------------
// Human-readable labels – single source of truth for all catalog statuses
// ---------------------------------------------------------------------------

export const lotStatusLabel: Record<LotStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Live",
  ended: "Ended",
  cancelled: "Cancelled",
  voided: "Voided",
};

export const saleStatusLabel: Record<SaleStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Live",
  ended: "Ended",
  cancelled: "Cancelled",
};

export const artistStatusLabel: Record<ArtistStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  merged_into: "Merged",
};

export const submissionStatusLabel: Record<ItemSubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  converted: "Converted",
};

// ---------------------------------------------------------------------------
// Variant mappers for StatusBadge
// ---------------------------------------------------------------------------

/** Maps catalog lot lifecycle to `StatusBadge` variants (OCP: extend map, not callers). */
export function lotStatusToBadgeVariant(status: LotStatus | string): AdminStatusBadgeVariant {
  switch (status) {
    case "active":
      return "live";
    case "scheduled":
      return "info";
    case "draft":
      return "neutral";
    case "ended":
      return "success";
    case "cancelled":
    case "voided":
      return "danger";
    default:
      return "neutral";
  }
}

export function saleStatusToBadgeVariant(status: SaleStatus): AdminStatusBadgeVariant {
  switch (status) {
    case "active":
      return "live";
    case "scheduled":
      return "info";
    case "draft":
      return "neutral";
    case "ended":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function artistStatusToBadgeVariant(status: ArtistStatus): AdminStatusBadgeVariant {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    case "merged_into":
      return "neutral";
    default:
      return "neutral";
  }
}

export function submissionStatusToBadgeVariant(
  status: ItemSubmissionStatus,
): AdminStatusBadgeVariant {
  switch (status) {
    case "approved":
    case "converted":
      return "success";
    case "submitted":
      return "info";
    case "under_review":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "Pending",
  authorized: "Authorized",
  captured: "Captured",
  refunded: "Refunded",
  requires_manual_review: "Manual review",
  cancelled: "Cancelled",
};

export function paymentStatusToBadgeVariant(status: PaymentStatus): AdminStatusBadgeVariant {
  switch (status) {
    case "captured":
      return "success";
    case "authorized":
      return "info";
    case "pending":
    case "requires_manual_review":
      return "warning";
    case "refunded":
      return "neutral";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export type CategoryLifecycleStatus = "active" | "archived";

export const categoryLifecycleLabel: Record<CategoryLifecycleStatus, string> = {
  active: "Active",
  archived: "Archived",
};

export function categoryLifecycleToBadgeVariant(
  status: CategoryLifecycleStatus,
): AdminStatusBadgeVariant {
  switch (status) {
    case "archived":
      return "danger";
    case "active":
      return "success";
    default:
      return "neutral";
  }
}

export const payoutStatusLabel: Record<PayoutStatus, string> = {
  scheduled: "Scheduled",
  in_transit: "In transit",
  paid: "Paid",
  failed: "Failed",
  reversed: "Reversed",
  clawback_pending: "Clawback pending",
};

export function payoutStatusToBadgeVariant(status: PayoutStatus | string): AdminStatusBadgeVariant {
  switch (status) {
    case "paid":
      return "success";
    case "in_transit":
      return "info";
    case "scheduled":
      return "neutral";
    case "failed":
    case "clawback_pending":
      return "warning";
    case "reversed":
      return "danger";
    default:
      return "neutral";
  }
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export const invitationStatusLabel: Record<InvitationStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked",
};

export function invitationStatusToBadgeVariant(
  status: InvitationStatus | string,
): AdminStatusBadgeVariant {
  switch (status) {
    case "accepted":
      return "success";
    case "pending":
      return "warning";
    case "expired":
      return "neutral";
    case "revoked":
      return "danger";
    default:
      return "neutral";
  }
}

/** Admin invitations table — UX lifecycle distinct from DB enum. */
export type InviteLifecycleStatus = "sent" | "opened" | "accepted" | "expired" | "bounced";

export const inviteLifecycleLabel: Record<InviteLifecycleStatus, string> = {
  sent: "Sent",
  opened: "Opened",
  accepted: "Accepted",
  expired: "Expired",
  bounced: "Bounced",
};

export function inviteLifecycleToBadgeVariant(
  status: InviteLifecycleStatus | string,
): AdminStatusBadgeVariant {
  switch (status) {
    case "accepted":
      return "success";
    case "opened":
      return "info";
    case "sent":
      return "neutral";
    case "expired":
      return "warning";
    case "bounced":
      return "danger";
    default:
      return "neutral";
  }
}

export type UserAccountStatus = "active" | "suspended";

export const userAccountStatusLabel: Record<UserAccountStatus, string> = {
  active: "Active",
  suspended: "Suspended",
};

export function userAccountStatusToBadgeVariant(
  status: UserAccountStatus | string,
): AdminStatusBadgeVariant {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
      return "danger";
    default:
      return "neutral";
  }
}

// ---------------------------------------------------------------------------
// Email outbox, suppressions, registrations, fulfilment, condition reports,
// saleroom, KYC, legal entity, disputes
// ---------------------------------------------------------------------------

export type EmailOutboxStatus = "queued" | "sending" | "sent" | "failed" | "suppressed";

export const emailOutboxStatusLabel: Record<EmailOutboxStatus, string> = {
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  suppressed: "Suppressed",
};

export function emailOutboxStatusToBadgeVariant(
  status: EmailOutboxStatus | string,
): AdminStatusBadgeVariant {
  switch (status) {
    case "sent":
      return "success";
    case "failed":
    case "suppressed":
      return "danger";
    case "sending":
      return "warning";
    case "queued":
      return "neutral";
    default:
      return "neutral";
  }
}

export type SuppressionReason = "hard_bounce" | "complaint" | "manual" | "unsubscribe";

export const suppressionReasonLabel: Record<SuppressionReason, string> = {
  hard_bounce: "Hard bounce",
  complaint: "Complaint",
  manual: "Manual",
  unsubscribe: "Unsubscribe",
};

export function suppressionReasonToBadgeVariant(
  reason: SuppressionReason | string,
): AdminStatusBadgeVariant {
  switch (reason) {
    case "complaint":
      return "danger";
    case "hard_bounce":
    case "manual":
      return "warning";
    case "unsubscribe":
      return "neutral";
    default:
      return "neutral";
  }
}

export type RegistrationStatus = "pending" | "approved" | "rejected" | "withdrawn";

export const registrationStatusLabel: Record<RegistrationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export function registrationStatusToBadgeVariant(
  status: RegistrationStatus | string,
): AdminStatusBadgeVariant {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    case "withdrawn":
      return "neutral";
    default:
      return "neutral";
  }
}

export type LotFulfilmentStatus =
  | "awaiting_payment"
  | "awaiting_release"
  | "released"
  | "ready_for_collection"
  | "in_transit"
  | "delivered"
  | "cancelled";

export const lotFulfilmentStatusLabel: Record<LotFulfilmentStatus, string> = {
  awaiting_payment: "Awaiting payment",
  awaiting_release: "Awaiting release",
  released: "Released",
  ready_for_collection: "Ready for collection",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function lotFulfilmentStatusToBadgeVariant(
  status: LotFulfilmentStatus | string,
): AdminStatusBadgeVariant {
  switch (status) {
    case "delivered":
      return "success";
    case "in_transit":
    case "released":
      return "info";
    case "awaiting_payment":
    case "awaiting_release":
    case "ready_for_collection":
      return "warning";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export type ConditionReportStatus = "requested" | "in_progress" | "fulfilled" | "declined";

export const conditionReportStatusLabel: Record<ConditionReportStatus, string> = {
  requested: "Requested",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  declined: "Declined",
};

export function conditionReportStatusToBadgeVariant(
  status: ConditionReportStatus | string,
): AdminStatusBadgeVariant {
  switch (status) {
    case "fulfilled":
      return "success";
    case "in_progress":
      return "info";
    case "requested":
    case "pending":
      return "warning";
    case "declined":
      return "danger";
    default:
      return "neutral";
  }
}

export type SaleroomSessionStatus = "idle" | "live" | "paused" | "closed";

export const saleroomSessionStatusLabel: Record<SaleroomSessionStatus, string> = {
  idle: "Idle",
  live: "Live",
  paused: "Paused",
  closed: "Closed",
};

export function saleroomSessionStatusToBadgeVariant(
  status: SaleroomSessionStatus | string,
): AdminStatusBadgeVariant {
  switch (status) {
    case "live":
      return "live";
    case "paused":
      return "warning";
    case "closed":
      return "neutral";
    default:
      return "neutral";
  }
}

export type KycStatus = "approved" | "pending" | "rejected" | null | undefined;

export function kycStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "approved":
      return "Verified";
    case "pending":
      return "In review";
    case "rejected":
      return "Rejected";
    default:
      return "Not verified";
  }
}

export function kycStatusToBadgeVariant(
  status: string | null | undefined,
): AdminStatusBadgeVariant {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export type LegalEntityStatus =
  | "lead"
  | "docs_requested"
  | "docs_received"
  | "under_review"
  | "approved"
  | "connect_pending"
  | "rejected"
  | "restricted"
  | "archived";

export const legalEntityStatusLabel: Record<LegalEntityStatus, string> = {
  lead: "Lead",
  docs_requested: "Docs requested",
  docs_received: "Docs received",
  under_review: "Under review",
  approved: "Approved",
  connect_pending: "Connect pending",
  rejected: "Rejected",
  restricted: "Restricted",
  archived: "Archived",
};

export function legalEntityStatusToBadgeVariant(
  status: LegalEntityStatus | string,
): AdminStatusBadgeVariant {
  switch (status) {
    case "approved":
    case "connect_pending":
      return "success";
    case "rejected":
    case "archived":
    case "restricted":
      return "danger";
    case "under_review":
    case "docs_received":
      return "info";
    case "docs_requested":
    case "lead":
      return "warning";
    default:
      return "neutral";
  }
}

export type DisputeStatus =
  | "open"
  | "won"
  | "lost"
  | "closed"
  | "warning_needs_response"
  | "under_review";

export const disputeStatusLabel: Record<DisputeStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
  closed: "Closed",
  warning_needs_response: "Needs response",
  under_review: "Under review",
};

export function disputeStatusToBadgeVariant(
  status: DisputeStatus | string,
): AdminStatusBadgeVariant {
  switch (status) {
    case "won":
      return "success";
    case "lost":
      return "danger";
    case "closed":
      return "neutral";
    case "open":
    case "warning_needs_response":
      return "warning";
    case "under_review":
      return "info";
    default:
      return "neutral";
  }
}

export type AmlMatchStatus = "no_match" | "potential_match" | "true_positive" | "false_positive";

export const amlMatchStatusLabel: Record<string, string> = {
  no_match: "No match",
  potential_match: "Potential match",
  true_positive: "Confirmed match",
  false_positive: "False positive",
};

export function amlMatchStatusToBadgeVariant(status: string): AdminStatusBadgeVariant {
  switch (status) {
    case "true_positive":
      return "danger";
    case "potential_match":
      return "warning";
    case "false_positive":
      return "success";
    case "no_match":
      return "neutral";
    default:
      return "neutral";
  }
}

export type AmlDecisionOutcome = "pending" | "clear" | "block" | "escalate";

export const amlDecisionOutcomeLabel: Record<string, string> = {
  pending: "Pending review",
  clear: "Clear",
  block: "Block",
  escalate: "Escalated",
};

export function amlDecisionOutcomeToBadgeVariant(status: string): AdminStatusBadgeVariant {
  switch (status) {
    case "clear":
      return "success";
    case "block":
      return "danger";
    case "escalate":
      return "warning";
    case "pending":
      return "info";
    default:
      return "neutral";
  }
}

export type SofCaseStatus = "pending" | "approved" | "rejected";

export const sofCaseStatusLabel: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export function sofCaseStatusToBadgeVariant(status: string): AdminStatusBadgeVariant {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}

export const onsiteEventStatusLabel: Record<string, string> = {
  published: "Published",
  draft: "Draft",
  cancelled: "Cancelled",
};

export function onsiteEventStatusToBadgeVariant(status: string): AdminStatusBadgeVariant {
  switch (status) {
    case "published":
      return "success";
    case "draft":
      return "neutral";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export type AdminStatusDomain =
  | "sale"
  | "lot"
  | "artist"
  | "submission"
  | "payment"
  | "payout"
  | "amlMatch"
  | "amlDecision"
  | "sofCase"
  | "invitation"
  | "inviteLifecycle"
  | "user"
  | "emailOutbox"
  | "suppression"
  | "registration"
  | "fulfilment"
  | "conditionReport"
  | "saleroomSession"
  | "kyc"
  | "legalEntity"
  | "dispute"
  | "category"
  | "venue"
  | "onsiteEvent";

export function adminStatusLabel(domain: AdminStatusDomain, status: string): string {
  switch (domain) {
    case "sale":
      return saleStatusLabel[status as SaleStatus] ?? status;
    case "lot":
      return lotStatusLabel[status as LotStatus] ?? status;
    case "artist":
      return artistStatusLabel[status as ArtistStatus] ?? status;
    case "submission":
      return submissionStatusLabel[status as ItemSubmissionStatus] ?? status;
    case "payment":
      return paymentStatusLabel[status as PaymentStatus] ?? status.replaceAll("_", " ");
    case "amlMatch":
      return amlMatchStatusLabel[status] ?? status.replaceAll("_", " ");
    case "amlDecision":
      return amlDecisionOutcomeLabel[status] ?? status.replaceAll("_", " ");
    case "sofCase":
      return sofCaseStatusLabel[status] ?? status.replaceAll("_", " ");
    case "payout":
      return payoutStatusLabel[status as PayoutStatus] ?? status.replaceAll("_", " ");
    case "invitation":
      return invitationStatusLabel[status as InvitationStatus] ?? status;
    case "inviteLifecycle":
      return inviteLifecycleLabel[status as InviteLifecycleStatus] ?? status;
    case "user":
      return userAccountStatusLabel[status as UserAccountStatus] ?? status;
    case "emailOutbox":
      return emailOutboxStatusLabel[status as EmailOutboxStatus] ?? status;
    case "suppression":
      return suppressionReasonLabel[status as SuppressionReason] ?? status;
    case "registration":
      return registrationStatusLabel[status as RegistrationStatus] ?? status;
    case "fulfilment":
      return lotFulfilmentStatusLabel[status as LotFulfilmentStatus] ?? status.replaceAll("_", " ");
    case "conditionReport":
      if (status === "pending") return "Requested";
      return (
        conditionReportStatusLabel[status as ConditionReportStatus] ?? status.replaceAll("_", " ")
      );
    case "saleroomSession":
      return saleroomSessionStatusLabel[status as SaleroomSessionStatus] ?? status;
    case "kyc":
      return kycStatusLabel(status);
    case "legalEntity":
      return legalEntityStatusLabel[status as LegalEntityStatus] ?? status.replaceAll("_", " ");
    case "dispute":
      return disputeStatusLabel[status as DisputeStatus] ?? status.replaceAll("_", " ");
    case "category":
      return categoryLifecycleLabel[status as CategoryLifecycleStatus] ?? status;
    case "venue":
      return status === "archived" ? "Archived" : "Active";
    case "onsiteEvent":
      return onsiteEventStatusLabel[status] ?? status.replaceAll("_", " ");
    default:
      return status;
  }
}

export function adminStatusToBadgeVariant(
  domain: AdminStatusDomain,
  status: string,
): AdminStatusBadgeVariant {
  switch (domain) {
    case "sale":
      return saleStatusToBadgeVariant(status as SaleStatus);
    case "lot":
      return lotStatusToBadgeVariant(status);
    case "artist":
      return artistStatusToBadgeVariant(status as ArtistStatus);
    case "submission":
      return submissionStatusToBadgeVariant(status as ItemSubmissionStatus);
    case "payment":
      return paymentStatusToBadgeVariant(status as PaymentStatus);
    case "amlMatch":
      return amlMatchStatusToBadgeVariant(status);
    case "amlDecision":
      return amlDecisionOutcomeToBadgeVariant(status);
    case "sofCase":
      return sofCaseStatusToBadgeVariant(status);
    case "payout":
      return payoutStatusToBadgeVariant(status);
    case "invitation":
      return invitationStatusToBadgeVariant(status);
    case "inviteLifecycle":
      return inviteLifecycleToBadgeVariant(status);
    case "user":
      return userAccountStatusToBadgeVariant(status);
    case "emailOutbox":
      return emailOutboxStatusToBadgeVariant(status);
    case "suppression":
      return suppressionReasonToBadgeVariant(status);
    case "registration":
      return registrationStatusToBadgeVariant(status);
    case "fulfilment":
      return lotFulfilmentStatusToBadgeVariant(status);
    case "conditionReport":
      return conditionReportStatusToBadgeVariant(status);
    case "saleroomSession":
      return saleroomSessionStatusToBadgeVariant(status);
    case "kyc":
      return kycStatusToBadgeVariant(status);
    case "legalEntity":
      return legalEntityStatusToBadgeVariant(status);
    case "dispute":
      return disputeStatusToBadgeVariant(status);
    case "category":
      return categoryLifecycleToBadgeVariant(status as CategoryLifecycleStatus);
    case "venue":
      return status === "archived" ? "neutral" : "success";
    case "onsiteEvent":
      return onsiteEventStatusToBadgeVariant(status);
    default:
      return "neutral";
  }
}
