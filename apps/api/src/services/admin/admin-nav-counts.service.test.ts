import { describe, expect, it, vi } from "vitest";
import { type AdminNavCountsDeps, AdminNavCountsService } from "./admin-nav-counts.service.js";

function deps(overrides: Partial<AdminNavCountsDeps> = {}): AdminNavCountsDeps {
  const zero = async () => 0;
  return {
    getSubmissionsPending: zero,
    getArtistsPending: zero,
    getConditionReportsPending: zero,
    getManualReviewCount: zero,
    getOnboardingIssuesTotal: zero,
    getLotFulfilmentPending: zero,
    getCollectionsToHandOver: zero,
    getWithdrawalsPending: zero,
    getDisputesOpen: zero,
    getPayoutsFailed: zero,
    getSaleroomLiveCount: zero,
    getInvitationsPending: zero,
    getDraftSalesNeedingSetup: zero,
    getDraftLotsMissingPhotos: zero,
    getAmlScreeningsPending: zero,
    getSourceOfFundsPending: zero,
    getTelephoneBookingsPending: zero,
    getLegalEntityStripeRequirements: zero,
    getFailedJobsNeedsReview: zero,
    ...overrides,
  };
}

describe("AdminNavCountsService failed jobs", () => {
  it("returns the Failed jobs count with the rest of the shared counts", async () => {
    const service = new AdminNavCountsService(deps({ getFailedJobsNeedsReview: async () => 12 }));
    expect((await service.getCounts()).failedJobsNeedsReview).toBe(12);
  });

  it("shows zero, and still answers, when that one count fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = new AdminNavCountsService(
      deps({
        getFailedJobsNeedsReview: async () => {
          throw new Error("db down");
        },
        getDisputesOpen: async () => 2,
      }),
    );
    expect(await service.getCounts()).toMatchObject({ failedJobsNeedsReview: 0, disputesOpen: 2 });
  });
});
