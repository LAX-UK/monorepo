import type { IAdminOnboardingIssuesReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { AdminOnboardingIssuesQueryService } from "./admin-onboarding-issues-query.service.js";

describe("AdminOnboardingIssuesQueryService.getPage", () => {
  it("returns paginated entities lens with cross-lens summary", async () => {
    const entities = [{ id: "le-1", displayName: "Gallery", status: "under_review" as const }];
    const reader: IAdminOnboardingIssuesReader = {
      summarizeAllQueues: vi.fn().mockResolvedValue({
        queueTotal: 6,
        entities: 1,
        artists: 2,
        kyc: 1,
        organizations: 1,
        documents: 1,
      }),
      listEntitiesPendingReview: vi.fn().mockResolvedValue({ rows: entities, total: 1 }),
      summarizeEntitiesPendingReview: vi.fn().mockResolvedValue({
        total: 1,
        docsReceived: 0,
        underReview: 1,
      }),
      listArtistsPendingApproval: vi.fn(),
      summarizeArtistsPendingApproval: vi.fn(),
      listStaleKycSessions: vi.fn(),
      summarizeStaleKycSessions: vi.fn(),
      listDocumentsAwaitingReview: vi.fn(),
      summarizeDocumentsAwaitingReview: vi.fn(),
      listStaleLeadOrganisations: vi.fn(),
      summarizeStaleLeadOrganisations: vi.fn(),
      findRowById: vi.fn(),
    };
    const svc = new AdminOnboardingIssuesQueryService(reader);

    await expect(svc.getPage({ tab: "entities", limit: 50, offset: 0 })).resolves.toEqual({
      tab: "entities",
      rows: entities,
      total: 1,
      offset: 0,
      limit: 50,
      summary: {
        queueTotal: 6,
        entities: 1,
        artists: 2,
        kyc: 1,
        organizations: 1,
        documents: 1,
      },
      lensSummary: {
        tab: "entities",
        summary: { total: 1, docsReceived: 0, underReview: 1 },
      },
    });
    expect(reader.listEntitiesPendingReview).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    expect(reader.summarizeAllQueues).toHaveBeenCalledOnce();
  });

  it("loads kyc lens rows and summary", async () => {
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
    const reader: IAdminOnboardingIssuesReader = {
      summarizeAllQueues: vi.fn().mockResolvedValue({
        queueTotal: 1,
        entities: 0,
        artists: 0,
        kyc: 1,
        organizations: 0,
        documents: 0,
      }),
      listEntitiesPendingReview: vi.fn(),
      summarizeEntitiesPendingReview: vi.fn(),
      listArtistsPendingApproval: vi.fn(),
      summarizeArtistsPendingApproval: vi.fn(),
      listStaleKycSessions: vi.fn().mockResolvedValue({ rows: staleKycSessions, total: 1 }),
      summarizeStaleKycSessions: vi.fn().mockResolvedValue({
        total: 1,
        created: 0,
        requiresInput: 0,
        processing: 1,
      }),
      listDocumentsAwaitingReview: vi.fn(),
      summarizeDocumentsAwaitingReview: vi.fn(),
      listStaleLeadOrganisations: vi.fn(),
      summarizeStaleLeadOrganisations: vi.fn(),
      findRowById: vi.fn(),
    };
    const svc = new AdminOnboardingIssuesQueryService(reader);

    const page = await svc.getPage({ tab: "kyc", limit: 25, offset: 10 });
    expect(page.rows).toEqual(staleKycSessions);
    expect(page.lensSummary).toEqual({
      tab: "kyc",
      summary: { total: 1, created: 0, requiresInput: 0, processing: 1 },
    });
    expect(reader.listStaleKycSessions).toHaveBeenCalledWith({ limit: 25, offset: 10 });
  });
});
