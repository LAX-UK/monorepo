import type {
  ArtistStatus,
  ItemSubmissionStatus,
  LotStatus,
  PaymentStatus,
  PayoutStatus,
  SaleStatus,
} from "@auction/types";
import {
  artistStatusLabel,
  artistStatusToBadgeVariant,
  categoryLifecycleLabel,
  categoryLifecycleToBadgeVariant,
  lotStatusLabel,
  lotStatusToBadgeVariant,
  saleStatusLabel,
  saleStatusToBadgeVariant,
  submissionStatusLabel,
  submissionStatusToBadgeVariant,
} from "./catalog";
import type { CategoryLifecycleStatus } from "./catalog";
import {
  amlDecisionOutcomeLabel,
  amlDecisionOutcomeToBadgeVariant,
  amlHoldStatusLabel,
  amlHoldStatusToBadgeVariant,
  amlMatchStatusLabel,
  amlMatchStatusToBadgeVariant,
  amlMonitorStatusLabel,
  amlMonitorStatusToBadgeVariant,
  disputeStatusLabel,
  disputeStatusToBadgeVariant,
  legalEntityStatusLabel,
  legalEntityStatusToBadgeVariant,
  sofCaseStatusLabel,
  sofCaseStatusToBadgeVariant,
} from "./compliance";
import type { DisputeStatus, LegalEntityStatus } from "./compliance";
import type {
  AdminStatusDomain,
  LotStatusContext,
  StatusBadgeVariant,
  StatusDomain,
  StatusPresentation,
  StatusPresentationContext,
} from "./core";
import {
  paymentStatusLabel,
  paymentStatusToBadgeVariant,
  payoutStatusLabel,
  payoutStatusToBadgeVariant,
} from "./finance";
import {
  conditionReportStatusLabel,
  conditionReportStatusToBadgeVariant,
  emailOutboxStatusLabel,
  emailOutboxStatusToBadgeVariant,
  lotFulfilmentStatusLabel,
  lotFulfilmentStatusToBadgeVariant,
  onsiteEventStatusLabel,
  onsiteEventStatusToBadgeVariant,
  saleroomSessionStatusLabel,
  saleroomSessionStatusToBadgeVariant,
  suppressionReasonLabel,
  suppressionReasonToBadgeVariant,
} from "./operations";
import type {
  ConditionReportStatus,
  EmailOutboxStatus,
  LotFulfilmentStatus,
  SaleroomSessionStatus,
  SuppressionReason,
} from "./operations";
import {
  invitationStatusLabel,
  invitationStatusToBadgeVariant,
  inviteLifecycleLabel,
  inviteLifecycleToBadgeVariant,
  kycStatusLabel,
  kycStatusToBadgeVariant,
  registrationStatusLabel,
  registrationStatusToBadgeVariant,
  userAccountStatusLabel,
  userAccountStatusToBadgeVariant,
} from "./people";
import type {
  InvitationStatus,
  InviteLifecycleStatus,
  RegistrationStatus,
  UserAccountStatus,
} from "./people";

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
    case "amlMonitor":
      return amlMonitorStatusLabel[status] ?? status.replaceAll("_", " ");
    case "amlHold":
      return amlHoldStatusLabel[status] ?? status.replaceAll("_", " ");
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
): StatusBadgeVariant {
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
    case "amlMonitor":
      return amlMonitorStatusToBadgeVariant(status);
    case "amlHold":
      return amlHoldStatusToBadgeVariant(status);
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

/** Outcome-aware label + variant for `ended` lots (uses API `winnerId` or list `hasWinner`). */
export function lotEndedPresentation(context?: LotStatusContext): StatusPresentation {
  const winnerId = context?.winnerId;
  const hasWinner = context?.hasWinner;
  if (winnerId != null || hasWinner === true) {
    return { label: "Sold", variant: "success" };
  }
  if (winnerId === null || hasWinner === false) {
    return { label: "Unsold", variant: "neutral" };
  }
  return { label: lotStatusLabel.ended, variant: "success" };
}

export function resolveLotStatusPresentation(
  status: LotStatus | string,
  context?: LotStatusContext,
): StatusPresentation {
  const variant = lotStatusToBadgeVariant(status);
  if (status === "ended") {
    return lotEndedPresentation(context);
  }
  const label = lotStatusLabel[status as LotStatus] ?? String(status);
  return { label, variant, dot: status === "active" };
}

export function resolveStatusPresentation(
  domain: StatusDomain,
  status: string,
  context?: StatusPresentationContext,
): StatusPresentation {
  if (domain === "lot") {
    return resolveLotStatusPresentation(status, context?.lot);
  }
  const label = adminStatusLabel(domain, status);
  const variant = adminStatusToBadgeVariant(domain, status);
  return { label, variant, dot: variant === "live" };
}

export type {
  AdminStatusDomain,
  LotStatusContext,
  StatusDomain,
  StatusPresentation,
  StatusPresentationContext,
};
