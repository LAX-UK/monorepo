export type AdminNavCounts = {
  submissionsPending: number;
  artistsPending: number;
  conditionReportsPending: number;
  manualReviewCount: number;
  onboardingIssuesTotal: number;
  lotFulfilmentPending: number;
  withdrawalsPending: number;
  disputesOpen: number;
  payoutsFailed: number;
  saleroomLiveCount: number;
  invitationsPending: number;
  draftSalesNeedingSetup: number;
  draftLotsMissingPhotos: number;
  amlScreeningsPending: number;
  sourceOfFundsPending: number;
  telephoneBookingsPending: number;
};

export type AdminNavCountsDeps = {
  getSubmissionsPending: () => Promise<number>;
  getArtistsPending: () => Promise<number>;
  getConditionReportsPending: () => Promise<number>;
  getManualReviewCount: () => Promise<number>;
  getOnboardingIssuesTotal: () => Promise<number>;
  getLotFulfilmentPending: () => Promise<number>;
  getWithdrawalsPending: () => Promise<number>;
  getDisputesOpen: () => Promise<number>;
  getPayoutsFailed: () => Promise<number>;
  getSaleroomLiveCount: () => Promise<number>;
  getInvitationsPending: () => Promise<number>;
  getDraftSalesNeedingSetup: () => Promise<number>;
  getDraftLotsMissingPhotos: () => Promise<number>;
  getAmlScreeningsPending: () => Promise<number>;
  getSourceOfFundsPending: () => Promise<number>;
  getTelephoneBookingsPending: () => Promise<number>;
};

const NAV_COUNTS_CACHE_KEY = "admin:nav-counts:v1";

/**
 * Nav badge counts for the admin sidebar.
 *
 * **Caching strategy:**
 * - 30-second TTL on Redis (configurable via constructor)
 * - Best-effort: failures fall through to fresh data
 *
 * **Cache invalidation:**
 * - TTL-based expiration is the primary mechanism
 * - For immediate consistency after mutations, call `invalidateCache()`
 * - Typical stale window: 0–30s (acceptable for badge counts)
 *
 * **Monitoring:**
 * - Silent fallback to 0 for individual count failures (graceful degradation)
 * - Console warnings emitted for fetch failures in development
 */
export class AdminNavCountsService {
  constructor(
    private readonly deps: AdminNavCountsDeps,
    private readonly cache?: import("../interfaces/cache.js").ICacheProvider,
    private readonly cacheTtlSec = 30,
  ) {}

  /** Invalidate the cached nav counts (call after mutations that affect badge counts). */
  async invalidateCache(): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.del(NAV_COUNTS_CACHE_KEY);
    } catch {
      // Del failure is non-critical; counts will TTL naturally
    }
  }

  async getCounts(): Promise<AdminNavCounts> {
    if (this.cache) {
      try {
        const cached = await this.cache.get(NAV_COUNTS_CACHE_KEY);
        if (cached != null) return JSON.parse(cached) as AdminNavCounts;
      } catch {
        // Cache read failure — fall through to loader.
      }
    }

    const value = await this.loadCounts();

    if (this.cache) {
      try {
        await this.cache.set(NAV_COUNTS_CACHE_KEY, JSON.stringify(value), this.cacheTtlSec);
      } catch {
        // Cache write failure — still return fresh counts.
      }
    }

    return value;
  }

  private async loadCounts(): Promise<AdminNavCounts> {
    const wrapWithLogging = (name: string, fn: () => Promise<number>): Promise<number> =>
      fn().catch((err) => {
        console.warn(`[AdminNavCountsService] ${name} failed:`, err);
        return 0;
      });

    const [
      submissionsPending,
      artistsPending,
      conditionReportsPending,
      manualReviewCount,
      onboardingIssuesTotal,
      lotFulfilmentPending,
      withdrawalsPending,
      disputesOpen,
      payoutsFailed,
      saleroomLiveCount,
      invitationsPending,
      draftSalesNeedingSetup,
      draftLotsMissingPhotos,
      amlScreeningsPending,
      sourceOfFundsPending,
      telephoneBookingsPending,
    ] = await Promise.all([
      wrapWithLogging("submissionsPending", this.deps.getSubmissionsPending),
      wrapWithLogging("artistsPending", this.deps.getArtistsPending),
      wrapWithLogging("conditionReportsPending", this.deps.getConditionReportsPending),
      wrapWithLogging("manualReviewCount", this.deps.getManualReviewCount),
      wrapWithLogging("onboardingIssuesTotal", this.deps.getOnboardingIssuesTotal),
      wrapWithLogging("lotFulfilmentPending", this.deps.getLotFulfilmentPending),
      wrapWithLogging("withdrawalsPending", this.deps.getWithdrawalsPending),
      wrapWithLogging("disputesOpen", this.deps.getDisputesOpen),
      wrapWithLogging("payoutsFailed", this.deps.getPayoutsFailed),
      wrapWithLogging("saleroomLiveCount", this.deps.getSaleroomLiveCount),
      wrapWithLogging("invitationsPending", this.deps.getInvitationsPending),
      wrapWithLogging("draftSalesNeedingSetup", this.deps.getDraftSalesNeedingSetup),
      wrapWithLogging("draftLotsMissingPhotos", this.deps.getDraftLotsMissingPhotos),
      wrapWithLogging("amlScreeningsPending", this.deps.getAmlScreeningsPending),
      wrapWithLogging("sourceOfFundsPending", this.deps.getSourceOfFundsPending),
      wrapWithLogging("telephoneBookingsPending", this.deps.getTelephoneBookingsPending),
    ]);

    return {
      submissionsPending,
      artistsPending,
      conditionReportsPending,
      manualReviewCount,
      onboardingIssuesTotal,
      lotFulfilmentPending,
      withdrawalsPending,
      disputesOpen,
      payoutsFailed,
      saleroomLiveCount,
      invitationsPending,
      draftSalesNeedingSetup,
      draftLotsMissingPhotos,
      amlScreeningsPending,
      sourceOfFundsPending,
      telephoneBookingsPending,
    };
  }
}
