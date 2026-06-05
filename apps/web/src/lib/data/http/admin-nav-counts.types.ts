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

export const EMPTY_ADMIN_NAV_COUNTS: AdminNavCounts = {
  submissionsPending: 0,
  artistsPending: 0,
  conditionReportsPending: 0,
  manualReviewCount: 0,
  onboardingIssuesTotal: 0,
  lotFulfilmentPending: 0,
  withdrawalsPending: 0,
  disputesOpen: 0,
  payoutsFailed: 0,
  saleroomLiveCount: 0,
  invitationsPending: 0,
  draftSalesNeedingSetup: 0,
  draftLotsMissingPhotos: 0,
  amlScreeningsPending: 0,
  sourceOfFundsPending: 0,
  telephoneBookingsPending: 0,
};
