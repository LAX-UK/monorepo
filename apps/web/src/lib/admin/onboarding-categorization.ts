import type { AdminOnboardingIssuesPayload } from "@/lib/data/http/admin.server";

export type OnboardingIssueBucketId =
  | "entities-pending-review"
  | "artists-pending"
  | "stale-kyc"
  | "documents-awaiting"
  | "stale-lead-orgs";

export type OnboardingIssueBucket = {
  id: OnboardingIssueBucketId;
  title: string;
  count: number;
  anchor: string;
};

/** Groups onboarding queue rows into the five operational buckets used on the admin home KPI strip. */
export function categorizeOnboardingIssues(
  data: AdminOnboardingIssuesPayload,
): OnboardingIssueBucket[] {
  return [
    {
      id: "entities-pending-review",
      title: "Legal entities pending review",
      count: data.entitiesPendingReview.length,
      anchor: "#entities-pending-review",
    },
    {
      id: "artists-pending",
      title: "Artists pending approval",
      count: data.artistsPendingApproval.length,
      anchor: "#artists-pending",
    },
    {
      id: "stale-kyc",
      title: "Stale KYC sessions",
      count: data.staleKycSessions.length,
      anchor: "#stale-kyc",
    },
    {
      id: "documents-awaiting",
      title: "Documents awaiting review",
      count: data.documentsAwaitingReview.length,
      anchor: "#documents-awaiting",
    },
    {
      id: "stale-lead-orgs",
      title: "Stale lead organisations",
      count: data.staleLeadOrganisations.length,
      anchor: "#stale-lead-orgs",
    },
  ];
}
