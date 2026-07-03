import { describe, expect, it, vi } from "vitest";
import { AdminOnboardingIssuesQueryService } from "./admin-onboarding-issues-query.service.js";

describe("AdminOnboardingIssuesQueryService.getOnboardingIssues", () => {
  it("returns grouped onboarding issue lists", async () => {
    const entities = [{ id: "le-1", displayName: "Gallery", status: "under_review" }];
    const artists = [{ id: "artist-1", displayName: "Artist", status: "pending" }];
    const staleKycSessions = [
      {
        id: "kyc-1",
        userId: "user-1",
        userName: "User",
        userEmail: "user@example.com",
        provider: "stripe",
        status: "processing",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ];
    const documentsAwaitingReview = [
      {
        id: "doc-1",
        legalEntityId: "le-1",
        entityDisplayName: "Gallery",
        uploadObjectId: "obj-1",
        uploadedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ];
    const staleLeadOrganisations = [
      { id: "lead-1", displayName: "Lead Org", createdAt: new Date("2025-12-01T00:00:00Z") },
    ];

    const reader = {
      getOnboardingIssues: vi.fn().mockResolvedValue({
        entitiesPendingReview: entities,
        artistsPendingApproval: artists,
        staleKycSessions,
        documentsAwaitingReview,
        staleLeadOrganisations,
      }),
    };
    const svc = new AdminOnboardingIssuesQueryService(reader);

    await expect(svc.getOnboardingIssues()).resolves.toEqual({
      entitiesPendingReview: entities,
      artistsPendingApproval: artists,
      staleKycSessions,
      documentsAwaitingReview,
      staleLeadOrganisations,
    });
    expect(reader.getOnboardingIssues).toHaveBeenCalledOnce();
  });
});
