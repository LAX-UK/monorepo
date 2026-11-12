export type AdminNavCounts = {
  submissionsPending: number;
  artistsPending: number;
  conditionReportsPending: number;
  manualReviewCount: number;
  onboardingIssuesTotal: number;
  lotFulfilmentPending: number;
  /** Collections booked for today that staff have yet to hand over. */
  collectionsToHandOver: number;
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
  legalEntityStripeRequirementsCount: number;
  /** Unanswered client messages the signed-in person has (per person, not from the shared cache). */
  inboxWaitingForYou: number;
  /** New enquiries on this person's queue, and how many are past their reply time (per person). */
  enquiriesWaiting: number;
  enquiriesLate: number;
  /** Open data requests due within 7 days, and those already overdue (per person, from Identity). */
  dataRequestsDueSoon: number;
  dataRequestsOverdue: number;
  /** Settled private sales whose artwork the register does not show as sold, and the urgent ones among them (per person). */
  privateSalesAttention: number;
  privateSalesUrgent: number;
};

export const EMPTY_ADMIN_NAV_COUNTS: AdminNavCounts = {
  submissionsPending: 0,
  artistsPending: 0,
  conditionReportsPending: 0,
  manualReviewCount: 0,
  onboardingIssuesTotal: 0,
  lotFulfilmentPending: 0,
  collectionsToHandOver: 0,
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
  legalEntityStripeRequirementsCount: 0,
  inboxWaitingForYou: 0,
  enquiriesWaiting: 0,
  enquiriesLate: 0,
  dataRequestsDueSoon: 0,
  dataRequestsOverdue: 0,
  privateSalesAttention: 0,
  privateSalesUrgent: 0,
};
