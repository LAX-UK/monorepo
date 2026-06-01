import "server-only";

import { saleNeedsSetup } from "@/lib/admin/catalog/sales-lenses";
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
  getAdminLotList,
  getAdminManualReviewPayments,
  getAdminOnboardingIssues,
  getAdminSaleroomSession,
  getAdminSalesList,
  getLotWithdrawalRequests,
  loadAdminLotFulfilmentQueue,
} from "@/lib/data/http/admin.server";
import {
  getAdminAmlScreeningsPending,
  getAdminSourceOfFundsPending,
} from "@/lib/data/http/compliance.server";
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
  getDraftSalesNeedingSetup: () => Promise<number>;
  getDraftLotsMissingPhotos: () => Promise<number>;
  getAmlScreeningsPending: () => Promise<number>;
  getSourceOfFundsPending: () => Promise<number>;
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
    const loaded = await loadAdminLotFulfilmentQueue({ limit: 1, offset: 0 });
    if (loaded.access !== "ok") return 0;
    const actionable = new Set([
      "awaiting_payment",
      "awaiting_release",
      "ready_for_collection",
      "released",
      "in_transit",
    ]);
    return Object.entries(loaded.statusCounts).reduce(
      (sum, [status, count]) => sum + (actionable.has(status) ? count : 0),
      0,
    );
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
  getDraftSalesNeedingSetup: async () => {
    const rows = await getAdminSalesList({ status: "draft", needsSetup: true, limit: 100 });
    return rows.filter((row) => saleNeedsSetup(row.sale, row.lots.length)).length;
  },
  getDraftLotsMissingPhotos: async () => {
    const rows = await getAdminLotList({ status: "draft", needsPhotos: true, limit: 200 });
    return rows.length;
  },
  getAmlScreeningsPending: async () => {
    const rows = await getAdminAmlScreeningsPending(200);
    return rows.length;
  },
  getSourceOfFundsPending: async () => {
    const rows = await getAdminSourceOfFundsPending(200);
    return rows.length;
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
    draftSalesNeedingSetup,
    draftLotsMissingPhotos,
    amlScreeningsPending,
    sourceOfFundsPending,
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
    fetchers.getDraftSalesNeedingSetup().catch(() => 0),
    fetchers.getDraftLotsMissingPhotos().catch(() => 0),
    fetchers.getAmlScreeningsPending().catch(() => 0),
    fetchers.getSourceOfFundsPending().catch(() => 0),
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
