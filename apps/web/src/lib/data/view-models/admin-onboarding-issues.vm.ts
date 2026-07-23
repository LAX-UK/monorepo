import type { AdminOnboardingIssuesCrossSummary } from "@/lib/data/http/admin-onboarding-issues.shared";
import type { AdminOnboardingIssuesPayload } from "@/lib/data/http/admin.server";

export type OnboardingTabId = "entities" | "artists" | "kyc" | "orgs" | "documents";

export const ONBOARDING_TAB_IDS: readonly OnboardingTabId[] = [
  "entities",
  "artists",
  "kyc",
  "orgs",
  "documents",
] as const;

export type OnboardingQueueSummary = {
  queueTotal: number;
  entities: number;
  artists: number;
  kyc: number;
  orgs: number;
  documents: number;
};

export function mapOnboardingCrossSummary(
  summary: AdminOnboardingIssuesCrossSummary,
): OnboardingQueueSummary {
  return {
    queueTotal: summary.queueTotal,
    entities: summary.entities,
    artists: summary.artists,
    kyc: summary.kyc,
    orgs: summary.organizations,
    documents: summary.documents,
  };
}

/** @deprecated Legacy monolithic payload — prefer `mapOnboardingCrossSummary`. */
export function summarizeOnboardingQueues(
  data: AdminOnboardingIssuesPayload,
): OnboardingQueueSummary {
  const entities = data.entitiesPendingReview.length;
  const artists = data.artistsPendingApproval.length;
  const kyc = data.staleKycSessions.length;
  const orgs = data.staleLeadOrganisations.length;
  const documents = data.documentsAwaitingReview.length;
  return {
    queueTotal: entities + artists + kyc + orgs + documents,
    entities,
    artists,
    kyc,
    orgs,
    documents,
  };
}

export function parseOnboardingTab(raw: string | undefined): OnboardingTabId {
  if (raw && (ONBOARDING_TAB_IDS as readonly string[]).includes(raw)) {
    return raw as OnboardingTabId;
  }
  return "entities";
}

export function onboardingTabCount(summary: OnboardingQueueSummary, tab: OnboardingTabId): number {
  switch (tab) {
    case "entities":
      return summary.entities;
    case "artists":
      return summary.artists;
    case "kyc":
      return summary.kyc;
    case "orgs":
      return summary.orgs;
    case "documents":
      return summary.documents;
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}
