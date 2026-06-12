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

export class AdminNavCountsService {
  constructor(private readonly deps: AdminNavCountsDeps) {}

  async getCounts(): Promise<AdminNavCounts> {
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
      this.deps.getSubmissionsPending().catch(() => 0),
      this.deps.getArtistsPending().catch(() => 0),
      this.deps.getConditionReportsPending().catch(() => 0),
      this.deps.getManualReviewCount().catch(() => 0),
      this.deps.getOnboardingIssuesTotal().catch(() => 0),
      this.deps.getLotFulfilmentPending().catch(() => 0),
      this.deps.getWithdrawalsPending().catch(() => 0),
      this.deps.getDisputesOpen().catch(() => 0),
      this.deps.getPayoutsFailed().catch(() => 0),
      this.deps.getSaleroomLiveCount().catch(() => 0),
      this.deps.getInvitationsPending().catch(() => 0),
      this.deps.getDraftSalesNeedingSetup().catch(() => 0),
      this.deps.getDraftLotsMissingPhotos().catch(() => 0),
      this.deps.getAmlScreeningsPending().catch(() => 0),
      this.deps.getSourceOfFundsPending().catch(() => 0),
      this.deps.getTelephoneBookingsPending().catch(() => 0),
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
