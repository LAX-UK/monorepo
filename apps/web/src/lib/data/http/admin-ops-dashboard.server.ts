import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
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

export async function getAdminFinanceIssues(): Promise<AdminFinanceIssuesPayload> {
  const res = await authedServerFetch("/admin/metrics/finance-issues");
  if (!res.ok) throw new Error(`Failed to load finance issue metrics: ${res.status}`);
  const body = (await res.json()) as { data: AdminFinanceIssuesPayload };
  return body.data;
}

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

export async function getAdminOnboardingIssues(): Promise<AdminOnboardingIssuesPayload> {
  const res = await authedServerFetch("/admin/onboarding-issues");
  if (!res.ok) throw new Error(`Failed to load onboarding issues: ${res.status}`);
  const body = (await res.json()) as { data: AdminOnboardingIssuesPayload };
  return body.data;
}

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

export async function getAdminManualReviewPayments(): Promise<AdminManualReviewPaymentRow[]> {
  const res = await authedServerFetch("/admin/payments/manual-review");
  if (!res.ok) throw new Error(`Failed to load manual review payments: ${res.status}`);
  const body = (await res.json()) as { data: AdminManualReviewPaymentRow[] };
  return body.data;
}

export async function getAdminMetricsToday(): Promise<AdminTodayMetricsPayload> {
  const res = await authedServerFetch("/admin/metrics/today");
  if (!res.ok) throw new Error(`Failed to load admin metrics: ${res.status}`);
  const body = (await res.json()) as { data: AdminTodayMetricsPayload };
  return body.data;
}

export async function getAdminMetricsLive(): Promise<{ bidsPerMinute: number }> {
  const res = await authedServerFetch("/admin/metrics/live");
  if (!res.ok) throw new Error(`Failed to load live metrics: ${res.status}`);
  const body = (await res.json()) as { data: { bidsPerMinute: number } };
  return body.data;
}

export type AdminAttentionFeedItem = {
  id: string;
  kind: "submission_under_review" | "payment_stale" | "lot_draft_past_start";
  title: string;
  hint: string;
  href: string;
  ctaLabel?: string;
  createdAt: string;
};

export async function getAdminAttentionFeed(): Promise<AdminAttentionFeedItem[]> {
  const res = await authedServerFetch("/admin/attention");
  if (!res.ok) throw new Error(`Failed to load attention feed: ${res.status}`);
  const body = (await res.json()) as { data: AdminAttentionFeedItem[] };
  return body.data;
}

export async function getAdminAnalytics(days = 30): Promise<AdminAnalyticsPayload> {
  const res = await authedServerFetch(`/admin/analytics?days=${encodeURIComponent(String(days))}`);
  if (!res.ok) {
    throw new Error(`Failed to load analytics: ${res.status}`);
  }
  const body = (await res.json()) as { data: AdminAnalyticsPayload };
  return body.data;
}
