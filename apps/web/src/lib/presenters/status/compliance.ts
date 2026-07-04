import type { StatusBadgeVariant } from "./core";
import { badgeVariantFromRegistry } from "./core";

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

export const legalEntityStatusBadgeVariant: Partial<Record<LegalEntityStatus, StatusBadgeVariant>> =
  {
    approved: "success",
    connect_pending: "success",
    rejected: "danger",
    archived: "danger",
    restricted: "danger",
    under_review: "info",
    docs_received: "info",
    docs_requested: "warning",
    lead: "warning",
  };

export function legalEntityStatusToBadgeVariant(
  status: LegalEntityStatus | string,
): StatusBadgeVariant {
  return badgeVariantFromRegistry(legalEntityStatusBadgeVariant, status);
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

export const disputeStatusBadgeVariant: Partial<Record<DisputeStatus, StatusBadgeVariant>> = {
  won: "success",
  lost: "danger",
  closed: "neutral",
  open: "warning",
  warning_needs_response: "warning",
  under_review: "info",
};

export function disputeStatusToBadgeVariant(status: DisputeStatus | string): StatusBadgeVariant {
  return badgeVariantFromRegistry(disputeStatusBadgeVariant, status);
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

export const amlMatchStatusBadgeVariant: Partial<Record<string, StatusBadgeVariant>> = {
  confirmed_match: "danger",
  true_positive: "danger",
  possible_match: "warning",
  potential_match: "warning",
  false_positive: "success",
  no_match: "neutral",
};

export function amlMatchStatusToBadgeVariant(status: string): StatusBadgeVariant {
  return badgeVariantFromRegistry(amlMatchStatusBadgeVariant, status);
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

export const amlMonitorStatusBadgeVariant: Partial<Record<string, StatusBadgeVariant>> = {
  monitored: "info",
  enabled: "info",
  monitoring_paused: "warning",
  not_monitored: "neutral",
  disabled: "neutral",
};

export function amlMonitorStatusToBadgeVariant(status: string): StatusBadgeVariant {
  return badgeVariantFromRegistry(amlMonitorStatusBadgeVariant, status);
}

export type AmlDecisionOutcome = "pending" | "clear" | "block" | "review" | "escalate";

export const amlDecisionOutcomeLabel: Record<string, string> = {
  pending: "Pending review",
  clear: "Clear",
  block: "Block",
  review: "Review",
  escalate: "Escalated",
};

export const amlDecisionOutcomeBadgeVariant: Partial<Record<string, StatusBadgeVariant>> = {
  clear: "success",
  block: "danger",
  review: "warning",
  escalate: "warning",
  pending: "info",
};

export function amlDecisionOutcomeToBadgeVariant(status: string): StatusBadgeVariant {
  return badgeVariantFromRegistry(amlDecisionOutcomeBadgeVariant, status);
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

export const amlHoldStatusBadgeVariant: Partial<Record<string, StatusBadgeVariant>> = {
  blocked: "danger",
  hold: "warning",
  none: "neutral",
};

export function amlHoldStatusToBadgeVariant(status: string): StatusBadgeVariant {
  return badgeVariantFromRegistry(amlHoldStatusBadgeVariant, status);
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

export const sofCaseStatusBadgeVariant: Partial<Record<string, StatusBadgeVariant>> = {
  approved: "success",
  rejected: "danger",
  awaiting_decision: "info",
  pending: "warning",
};

export function sofCaseStatusToBadgeVariant(status: string): StatusBadgeVariant {
  return badgeVariantFromRegistry(sofCaseStatusBadgeVariant, status);
}
