import type { StatusBadgeVariant } from "./core";

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
): StatusBadgeVariant {
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

export function disputeStatusToBadgeVariant(status: DisputeStatus | string): StatusBadgeVariant {
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

export type AmlMatchStatus =
  | "no_match"
  | "possible_match"
  | "confirmed_match"
  | "false_positive"
  | "potential_match"
  | "true_positive";

export const amlMatchStatusLabel: Record<string, string> = {
  no_match: "No match",
  possible_match: "Possible match",
  confirmed_match: "Confirmed match",
  false_positive: "False positive",
  potential_match: "Possible match",
  true_positive: "Confirmed match",
};

export function amlMatchStatusToBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case "confirmed_match":
    case "true_positive":
      return "danger";
    case "possible_match":
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

export type AmlMonitorStatus =
  | "monitored"
  | "not_monitored"
  | "monitoring_paused"
  | "enabled"
  | "disabled";

export const amlMonitorStatusLabel: Record<string, string> = {
  monitored: "Monitored",
  not_monitored: "Not monitored",
  monitoring_paused: "Monitoring paused",
  enabled: "Monitored",
  disabled: "Not monitored",
};

export function amlMonitorStatusToBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case "monitored":
    case "enabled":
      return "info";
    case "monitoring_paused":
      return "warning";
    case "not_monitored":
    case "disabled":
      return "neutral";
    default:
      return "neutral";
  }
}

export type AmlDecisionOutcome = "pending" | "clear" | "block" | "review" | "escalate";

export const amlDecisionOutcomeLabel: Record<string, string> = {
  pending: "Pending review",
  clear: "Clear",
  block: "Block",
  review: "Review",
  escalate: "Escalated",
};

export function amlDecisionOutcomeToBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case "clear":
      return "success";
    case "block":
      return "danger";
    case "review":
    case "escalate":
      return "warning";
    case "pending":
      return "info";
    default:
      return "neutral";
  }
}

export const amlWatchlistCategoryLabel: Record<string, string> = {
  sanction: "Sanctions",
  pep: "PEP",
  adverse_media: "Adverse media",
  warning: "Warnings",
  fitness_probity: "Fitness & probity",
  other: "Other",
};

export function formatAmlCategoriesLabel(categories: string[]): string {
  if (categories.length === 0) return "—";
  return categories
    .map((category) => amlWatchlistCategoryLabel[category] ?? category.replaceAll("_", " "))
    .join(", ");
}

export type AmlHoldStatus = "none" | "hold" | "blocked";

export const amlHoldStatusLabel: Record<string, string> = {
  none: "No hold",
  hold: "Settlement hold",
  blocked: "Blocked",
};

export const amlHoldReasonLabel: Record<string, string> = {
  sanctions_match: "Sanctions match",
  pep_match: "PEP match",
  adverse_media_match: "Adverse media match",
  screening_review: "Screening review",
};

export function amlHoldStatusToBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case "blocked":
      return "danger";
    case "hold":
      return "warning";
    default:
      return "neutral";
  }
}

export function formatAmlHoldReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return amlHoldReasonLabel[reason] ?? reason.replaceAll("_", " ");
}

export type SofCaseStatus = "pending" | "awaiting_decision" | "approved" | "rejected";

export const sofCaseStatusLabel: Record<string, string> = {
  pending: "Pending review",
  awaiting_decision: "Awaiting MLRO decision",
  approved: "Approved",
  rejected: "Rejected",
};

export function sofCaseStatusToBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "awaiting_decision":
      return "info";
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}
