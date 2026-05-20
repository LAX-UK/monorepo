import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAdminNavCounts } from "./admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "./admin-nav-counts.types";

function mockFetchers(overrides: Partial<Record<keyof typeof EMPTY_ADMIN_NAV_COUNTS, number>>) {
  return {
    getSubmissionsPending: vi.fn().mockResolvedValue(overrides.submissionsPending ?? 0),
    getArtistsPending: vi.fn().mockResolvedValue(overrides.artistsPending ?? 0),
    getConditionReportsPending: vi.fn().mockResolvedValue(overrides.conditionReportsPending ?? 0),
    getManualReviewCount: vi.fn().mockResolvedValue(overrides.manualReviewCount ?? 0),
    getOnboardingIssuesTotal: vi.fn().mockResolvedValue(overrides.onboardingIssuesTotal ?? 0),
    getLotFulfilmentPending: vi.fn().mockResolvedValue(overrides.lotFulfilmentPending ?? 0),
    getWithdrawalsPending: vi.fn().mockResolvedValue(overrides.withdrawalsPending ?? 0),
    getDisputesOpen: vi.fn().mockResolvedValue(overrides.disputesOpen ?? 0),
    getPayoutsFailed: vi.fn().mockResolvedValue(overrides.payoutsFailed ?? 0),
    getSaleroomLiveCount: vi.fn().mockResolvedValue(overrides.saleroomLiveCount ?? 0),
    getInvitationsPending: vi.fn().mockResolvedValue(overrides.invitationsPending ?? 0),
  };
}

describe("getAdminNavCounts", () => {
  it("loads counts from injected fetchers", async () => {
    const fetchers = mockFetchers({ submissionsPending: 3, artistsPending: 2, payoutsFailed: 1 });
    const counts = await getAdminNavCounts(fetchers);
    expect(counts.submissionsPending).toBe(3);
    expect(counts.artistsPending).toBe(2);
    expect(counts.payoutsFailed).toBe(1);
    expect(fetchers.getSubmissionsPending).toHaveBeenCalledOnce();
  });

  it("falls back to zero when a fetcher throws", async () => {
    const fetchers = mockFetchers({ artistsPending: 5 });
    fetchers.getSubmissionsPending = vi.fn().mockRejectedValue(new Error("network"));
    const counts = await getAdminNavCounts(fetchers);
    expect(counts.submissionsPending).toBe(0);
    expect(counts.artistsPending).toBe(5);
  });

  it("returns all keys from AdminNavCounts", async () => {
    const counts = await getAdminNavCounts(mockFetchers({}));
    expect(Object.keys(counts).sort()).toEqual(Object.keys(EMPTY_ADMIN_NAV_COUNTS).sort());
  });
});
