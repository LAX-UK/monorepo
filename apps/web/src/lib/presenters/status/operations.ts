import type { StatusBadgeVariant } from "./core";

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
): StatusBadgeVariant {
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
): StatusBadgeVariant {
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
): StatusBadgeVariant {
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
): StatusBadgeVariant {
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
): StatusBadgeVariant {
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

export const onsiteEventStatusLabel: Record<string, string> = {
  published: "Published",
  draft: "Draft",
  cancelled: "Cancelled",
};

export function onsiteEventStatusToBadgeVariant(status: string): StatusBadgeVariant {
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
