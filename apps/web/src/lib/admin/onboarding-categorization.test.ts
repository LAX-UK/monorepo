import { describe, expect, it } from "vitest";
import { categorizeOnboardingIssues } from "./onboarding-categorization";

const emptyPayload = {
  entitiesPendingReview: [],
  artistsPendingApproval: [],
  staleKycSessions: [],
  documentsAwaitingReview: [],
  staleLeadOrganisations: [],
};

describe("categorizeOnboardingIssues", () => {
  it("returns five buckets with stable ids and anchors", () => {
    const buckets = categorizeOnboardingIssues(emptyPayload);
    expect(buckets).toHaveLength(5);
    expect(buckets.map((b) => b.id)).toEqual([
      "entities-pending-review",
      "artists-pending",
      "stale-kyc",
      "documents-awaiting",
      "stale-lead-orgs",
    ]);
    for (const bucket of buckets) {
      expect(bucket.anchor).toBe(`#${bucket.id}`);
    }
  });

  it("counts rows per bucket", () => {
    const buckets = categorizeOnboardingIssues({
      ...emptyPayload,
      entitiesPendingReview: [{ id: "e1", displayName: "A", status: "under_review" }],
      artistsPendingApproval: [
        { id: "a1", displayName: "B", status: "pending" },
        { id: "a2", displayName: "C", status: "pending" },
      ],
      staleKycSessions: [
        {
          id: "s1",
          userId: "u1",
          userName: "Test User",
          userEmail: "test@example.com",
          provider: "veriff",
          status: "pending",
          createdAt: "",
        },
      ],
      documentsAwaitingReview: [],
      staleLeadOrganisations: [
        { id: "o1", displayName: "Org", createdAt: "" },
        { id: "o2", displayName: "Org2", createdAt: "" },
        { id: "o3", displayName: "Org3", createdAt: "" },
      ],
    });
    expect(buckets.find((b) => b.id === "entities-pending-review")?.count).toBe(1);
    expect(buckets.find((b) => b.id === "artists-pending")?.count).toBe(2);
    expect(buckets.find((b) => b.id === "stale-kyc")?.count).toBe(1);
    expect(buckets.find((b) => b.id === "documents-awaiting")?.count).toBe(0);
    expect(buckets.find((b) => b.id === "stale-lead-orgs")?.count).toBe(3);
  });
});
