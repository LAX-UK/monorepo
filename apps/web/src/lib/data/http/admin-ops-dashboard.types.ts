import type { LegalEntityStatus } from "@auction/types";

export type AdminAnalyticsPayload = {
  activeLots: number;
  lotCompletedSeries: { date: string; count: number }[];
  conversion: { ended: number; withWinner: number };
  revenueSeries: { date: string; total: string }[];
  averageOrderValue: string | null;
  registrationSeries: { date: string; count: number }[];
  totalUsers: number;
  sparklines?: {
    revenue: readonly number[];
    lotCompleted: readonly number[];
    registrations: readonly number[];
  };
};

export type AdminTodayMetricsPayload = {
  liveLots: number;
  endingWithinHour: number;
  draftLots: number;
  pendingSubmissions: number;
  stalePendingPayments: number;
  revenueToday: string;
};

export type AdminFinanceIssuesPayload = {
  failedPayoutCount: number;
  legalEntitiesWithStripeConnectRequirementsCount: number;
  staleBlockedScheduledPayoutCount: number;
  entitiesPendingReviewCount: number;
  artistsPendingApprovalCount: number;
  staleKycSessionsCount: number;
  documentsAwaitingReviewCount: number;
  staleLeadOrganisationsCount: number;
};

export type AdminOnboardingIssuesPayload = {
  entitiesPendingReview: { id: string; displayName: string; status: string }[];
  artistsPendingApproval: { id: string; displayName: string; status: string }[];
  staleKycSessions: {
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    provider: string;
    status: string;
    createdAt: string;
  }[];
  documentsAwaitingReview: {
    id: string;
    legalEntityId: string;
    entityDisplayName: string;
    uploadObjectId: string;
    uploadedAt: string;
  }[];
  staleLeadOrganisations: { id: string; displayName: string; createdAt: string }[];
};

export type AdminManualReviewPaymentRow = {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  winnerUserId: string;
  winnerEmail: string;
  sellerLegalEntityId: string;
  sellerDisplayName: string;
  sellerStatus: LegalEntityStatus;
  sellerArchivedAt: string | null;
  amount: string;
  currency: string;
  archiveReason: string | null;
  archiveTimestamp: string | null;
  manualReviewReason:
    | "seller_archived"
    | "high_value"
    | "seller_archived_and_high_value"
    | "aml_hold"
    | "source_of_funds_required"
    | "finance_release_required"
    | null;
  /** Pending SoF case id when manualReviewReason is source_of_funds_required. */
  sourceOfFundsCaseId: string | null;
  createdAt: string;
};

export type AdminAttentionFeedItem = {
  id: string;
  kind: "submission_under_review" | "payment_stale" | "lot_draft_past_start";
  title: string;
  hint: string;
  href: string;
  ctaLabel?: string;
  createdAt: string;
};
