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
