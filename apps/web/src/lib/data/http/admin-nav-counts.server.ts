import "server-only";

import { categorizeOnboardingIssues } from "@/lib/admin/onboarding-categorization";
import {
  type AdminNavCounts,
  EMPTY_ADMIN_NAV_COUNTS,
} from "@/lib/data/http/admin-nav-counts.types";
import {
  getAdminArtistStats,
  getAdminConditionReportRequests,
  getAdminFinanceDisputeDomainEvents,
  getAdminFinanceIssues,
  getAdminLotFulfilmentList,
  getAdminManualReviewPayments,
  getAdminOnboardingIssues,
  getAdminSaleroomSession,
  getAdminSalesList,
  getLotWithdrawalRequests,
} from "@/lib/data/http/admin.server";
import { getAdminInvitations } from "@/lib/data/http/invitations.server";
import { getAdminSubmissionPendingCount } from "@/lib/data/http/submissions.server";
import { cache } from "react";

export type AdminNavCountFetchers = {
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
};

const defaultFetchers: AdminNavCountFetchers = {
  getSubmissionsPending: getAdminSubmissionPendingCount,
  getArtistsPending: async () => {
    const stats = await getAdminArtistStats();
    return stats.pendingReview;
  },
  getConditionReportsPending: async () => {
    const [pending, inProgress] = await Promise.all([
      getAdminConditionReportRequests({ status: "pending", limit: 1, offset: 0 }),
      getAdminConditionReportRequests({ status: "in_progress", limit: 1, offset: 0 }),
    ]);
    return pending.total + inProgress.total;
  },
  getManualReviewCount: async () => {
    const rows = await getAdminManualReviewPayments();
    return rows.length;
  },
  getOnboardingIssuesTotal: async () => {
    const issues = await getAdminOnboardingIssues();
    return categorizeOnboardingIssues(issues).reduce((sum, bucket) => sum + bucket.count, 0);
  },
  getLotFulfilmentPending: async () => {
    const rows = await getAdminLotFulfilmentList();
    const actionable = new Set([
      "awaiting_payment",
      "awaiting_release",
      "ready_for_collection",
      "released",
      "in_transit",
    ]);
    return rows.filter((r) => actionable.has(r.status)).length;
  },
  getWithdrawalsPending: async () => {
    const rows = await getLotWithdrawalRequests();
    return rows.length;
  },
  getDisputesOpen: async () => {
    const rows = await getAdminFinanceDisputeDomainEvents({ limit: 100, offset: 0 });
    return rows.filter(
      (r) =>
        r.eventType.includes("opened") ||
        r.eventType.includes("funds_withdrawn") ||
        (!r.eventType.includes("closed") && !r.eventType.includes("won")),
    ).length;
  },
  getPayoutsFailed: async () => {
    const finance = await getAdminFinanceIssues();
    return finance.failedPayoutCount;
  },
  getSaleroomLiveCount: async () => {
    const sales = await getAdminSalesList({ limit: 30 });
    const active = sales.filter((row) => row.sale.status === "active");
    if (active.length === 0) return 0;
    const snapshots = await Promise.all(
      active.map((row) =>
        getAdminSaleroomSession(row.sale.id).catch(() => ({ session: null, events: [] })),
      ),
    );
    return snapshots.filter((s) => {
      const st = s.session?.status;
      return st === "live" || st === "paused";
    }).length;
  },
  getInvitationsPending: async () => {
    const rows = await getAdminInvitations();
    return rows.filter((i) => i.status === "pending").length;
  },
};

async function loadAdminNavCounts(
  fetchers: AdminNavCountFetchers = defaultFetchers,
): Promise<AdminNavCounts> {
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
  ] = await Promise.all([
    fetchers.getSubmissionsPending().catch(() => 0),
    fetchers.getArtistsPending().catch(() => 0),
    fetchers.getConditionReportsPending().catch(() => 0),
    fetchers.getManualReviewCount().catch(() => 0),
    fetchers.getOnboardingIssuesTotal().catch(() => 0),
    fetchers.getLotFulfilmentPending().catch(() => 0),
    fetchers.getWithdrawalsPending().catch(() => 0),
    fetchers.getDisputesOpen().catch(() => 0),
    fetchers.getPayoutsFailed().catch(() => 0),
    fetchers.getSaleroomLiveCount().catch(() => 0),
    fetchers.getInvitationsPending().catch(() => 0),
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
  };
}

/** Loads staff sidebar badge counts from admin APIs (zeros on individual fetch failure). */
export const getAdminNavCounts = cache(loadAdminNavCounts);

async function loadFinanceAdminNavCounts(
  fetchers: Pick<
    AdminNavCountFetchers,
    "getManualReviewCount" | "getDisputesOpen" | "getPayoutsFailed"
  > = {
    getManualReviewCount: defaultFetchers.getManualReviewCount,
    getDisputesOpen: defaultFetchers.getDisputesOpen,
    getPayoutsFailed: defaultFetchers.getPayoutsFailed,
  },
): Promise<AdminNavCounts> {
  const [manualReviewCount, disputesOpen, payoutsFailed] = await Promise.all([
    fetchers.getManualReviewCount().catch(() => 0),
    fetchers.getDisputesOpen().catch(() => 0),
    fetchers.getPayoutsFailed().catch(() => 0),
  ]);
  return {
    ...EMPTY_ADMIN_NAV_COUNTS,
    manualReviewCount,
    disputesOpen,
    payoutsFailed,
  };
}

/** Finance-shell badge counts (subset of full platform nav counts). */
export const getFinanceAdminNavCounts = cache(loadFinanceAdminNavCounts);

export type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
export { EMPTY_ADMIN_NAV_COUNTS };
