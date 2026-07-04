import type { StatusBadgeVariant } from "./core";
import { badgeVariantFromRegistry } from "./core";

export type EmailOutboxStatus = "queued" | "sending" | "sent" | "failed" | "suppressed";

export const emailOutboxStatusLabel: Record<EmailOutboxStatus, string> = {
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  suppressed: "Suppressed",
};

export const emailOutboxStatusBadgeVariant: Partial<Record<EmailOutboxStatus, StatusBadgeVariant>> =
  {
    sent: "success",
    failed: "danger",
    suppressed: "danger",
    sending: "warning",
    queued: "neutral",
  };

export function emailOutboxStatusToBadgeVariant(
  status: EmailOutboxStatus | string,
): StatusBadgeVariant {
  return badgeVariantFromRegistry(emailOutboxStatusBadgeVariant, status);
}

export type SuppressionReason = "hard_bounce" | "complaint" | "manual" | "unsubscribe";

export const suppressionReasonLabel: Record<SuppressionReason, string> = {
  hard_bounce: "Hard bounce",
  complaint: "Complaint",
  manual: "Manual",
  unsubscribe: "Unsubscribe",
};

export const suppressionReasonBadgeVariant: Partial<Record<SuppressionReason, StatusBadgeVariant>> =
  {
    complaint: "danger",
    hard_bounce: "warning",
    manual: "warning",
    unsubscribe: "neutral",
  };

export function suppressionReasonToBadgeVariant(
  reason: SuppressionReason | string,
): StatusBadgeVariant {
  return badgeVariantFromRegistry(suppressionReasonBadgeVariant, reason);
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

export const lotFulfilmentStatusBadgeVariant: Partial<
  Record<LotFulfilmentStatus | "pending", StatusBadgeVariant>
> = {
  delivered: "success",
  in_transit: "info",
  released: "info",
  awaiting_payment: "warning",
  awaiting_release: "warning",
  ready_for_collection: "warning",
  cancelled: "danger",
};

export function lotFulfilmentStatusToBadgeVariant(
  status: LotFulfilmentStatus | string,
): StatusBadgeVariant {
  return badgeVariantFromRegistry(lotFulfilmentStatusBadgeVariant, status);
}

export type ConditionReportStatus = "requested" | "in_progress" | "fulfilled" | "declined";

export const conditionReportStatusLabel: Record<ConditionReportStatus, string> = {
  requested: "Requested",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  declined: "Declined",
};

export const conditionReportStatusBadgeVariant: Partial<
  Record<ConditionReportStatus | "pending", StatusBadgeVariant>
> = {
  fulfilled: "success",
  in_progress: "info",
  requested: "warning",
  pending: "warning",
  declined: "danger",
};

export function conditionReportStatusToBadgeVariant(
  status: ConditionReportStatus | string,
): StatusBadgeVariant {
  return badgeVariantFromRegistry(conditionReportStatusBadgeVariant, status);
}

export type SaleroomSessionStatus = "idle" | "live" | "paused" | "closed";

export const saleroomSessionStatusLabel: Record<SaleroomSessionStatus, string> = {
  idle: "Idle",
  live: "Live",
  paused: "Paused",
  closed: "Closed",
};

export const saleroomSessionStatusBadgeVariant: Partial<
  Record<SaleroomSessionStatus, StatusBadgeVariant>
> = {
  live: "live",
  paused: "warning",
  closed: "neutral",
  idle: "neutral",
};

export function saleroomSessionStatusToBadgeVariant(
  status: SaleroomSessionStatus | string,
): StatusBadgeVariant {
  return badgeVariantFromRegistry(saleroomSessionStatusBadgeVariant, status);
}

export const onsiteEventStatusLabel: Record<string, string> = {
  published: "Published",
  draft: "Draft",
  cancelled: "Cancelled",
};

export const onsiteEventStatusBadgeVariant: Partial<Record<string, StatusBadgeVariant>> = {
  published: "success",
  draft: "neutral",
  cancelled: "danger",
};

export function onsiteEventStatusToBadgeVariant(status: string): StatusBadgeVariant {
  return badgeVariantFromRegistry(onsiteEventStatusBadgeVariant, status);
}
