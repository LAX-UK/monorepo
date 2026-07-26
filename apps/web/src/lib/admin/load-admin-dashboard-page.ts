import "server-only";

import type { AdminActivityRow, AdminAttentionRow } from "@/lib/admin/admin-home-types";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import { buildSyntheticAttentionRows } from "@/lib/admin/build-synthetic-attention-rows";
import {
  type HubQuickLink,
  canAccess,
  hubQuickLinksFor,
  isWidgetAllowed,
} from "@/lib/admin/dashboard-access";
import type { DashboardWidgetState } from "@/lib/admin/dashboard-widgets.vm";
import {
  type OnsiteSalesRadarRow,
  mapOperationsSnapshotToRadarRow,
} from "@/lib/admin/saleroom/map-operations-snapshot-to-radar-row";
import { getAdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import {
  getAdminAttentionFeed,
  getAdminFinanceIssues,
  getAdminLotList,
  getAdminMetricsLive,
  getAdminMetricsToday,
  getAdminSaleOperationsSnapshot,
  getAdminSalesList,
} from "@/lib/data/http/admin.server";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import {
  FINANCE_ACCESS,
  LOTS_ACCESS,
  SALEROOM_ACCESS,
  type UserRole,
  type UserStaffRole,
} from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

export type AdminDashboardPageInput = {
  periodDays: AdminKpiPeriodDays;
  role: UserRole;
  staffRole: UserStaffRole | null;
  widgets: readonly DashboardWidgetState[];
};

export type AdminDashboardPageModel = {
  metrics: Awaited<ReturnType<typeof getAdminMetricsToday>>;
  trends: Awaited<ReturnType<typeof getAdminHomeKpiTrends>>;
  bidsPerMinute: number;
  activeLotIds: string[];
  attention: AdminAttentionRow[];
  activity: AdminActivityRow[];
  anomalies: ReturnType<typeof detectAnomaliesFromNavCounts>;
  onsiteRadarRows: OnsiteSalesRadarRow[];
  activeSaleroomSessions: number;
  loadWarning: string | null;
  hubLinks: HubQuickLink[];
};

/** Data/composition boundary for `/admin` home dashboard. */
export async function loadAdminDashboardPage(
  input: AdminDashboardPageInput,
): Promise<AdminDashboardPageModel> {
  const { periodDays, role, staffRole } = input;
  const can = (req: Parameters<typeof canAccess>[2]) => canAccess(role, staffRole, req);
  const canAccessLots = can(LOTS_ACCESS);
  const canAccessFinance = can(FINANCE_ACCESS);
  const canAccessSaleroom = can(SALEROOM_ACCESS);

  let metrics = {
    liveLots: 0,
    endingWithinHour: 0,
    draftLots: 0,
    pendingSubmissions: 0,
    stalePendingPayments: 0,
    revenueToday: "0",
  };
  let bidsPerMinute = 0;
  let activeLotIds: string[] = [];
  let attention: AdminAttentionRow[] = [];
  let recentLots: Awaited<ReturnType<typeof getAdminLotList>> = [];
  let financeIssues: Awaited<ReturnType<typeof getAdminFinanceIssues>> | null = null;
  let onsiteRadarRows: OnsiteSalesRadarRow[] = [];
  let dashboardLoadWarning: string | null = null;
  let trends: Awaited<ReturnType<typeof getAdminHomeKpiTrends>> = {
    lots: { currentTotal: 0, priorTotal: 0, dailyCounts: [] },
    submissions: { currentTotal: 0, priorTotal: 0, dailyCounts: [] },
    payments: { currentTotal: 0, priorTotal: 0, dailyCounts: [] },
  };

  const results = await Promise.allSettled([
    getAdminMetricsToday(),
    getAdminMetricsLive(),
    canAccessLots
      ? getAdminLotList({ status: "active", limit: 20, sort: "endingAsc" })
      : Promise.resolve([]),
    getAdminAttentionFeed(),
    canAccessLots ? getAdminLotList({ limit: 12, sort: "endingAsc" }) : Promise.resolve([]),
    getAdminHomeKpiTrends(periodDays),
    canAccessFinance ? getAdminFinanceIssues() : Promise.resolve(null),
  ]);

  const [metricsR, liveR, activeR, feedR, recentR, trendsR, financeR] = results;

  if (metricsR.status === "fulfilled") {
    metrics = metricsR.value;
  } else {
    dashboardLoadWarning = "Could not load dashboard metrics.";
  }

  if (liveR.status === "fulfilled") {
    bidsPerMinute = liveR.value.bidsPerMinute;
  }

  if (activeR.status === "fulfilled") {
    activeLotIds = activeR.value.map((a) => a.id);
  } else if (canAccessLots) {
    dashboardLoadWarning ??= "Could not load active lots.";
  }

  if (feedR.status === "fulfilled") {
    attention = feedR.value.map((item) => ({
      id: item.id,
      title: item.title,
      hint: item.hint,
      href: item.kind === "lot_draft_past_start" ? "/admin/lots?lens=attention" : item.href,
      ctaLabel: item.ctaLabel ?? "Open",
    }));
  }

  if (recentR.status === "fulfilled") {
    recentLots = recentR.value;
  }

  if (trendsR.status === "fulfilled") {
    trends = trendsR.value;
  }

  if (financeR.status === "fulfilled") {
    financeIssues = financeR.value;
  } else if (canAccessFinance) {
    dashboardLoadWarning ??= "Could not load finance dashboard alerts.";
  }

  const activity: AdminActivityRow[] = recentLots.slice(0, 10).map((l) => ({
    id: l.id,
    title: l.title,
    meta: `${l.status} · ends ${formatDateTime(l.endTime)}`,
    href: `/admin/lots/${l.id}`,
    statusLabel: l.status,
    winnerId: l.winnerId,
    priceLabel: formatMoney(l.currentPrice),
    endsLabel: formatDateTime(l.endTime),
  }));

  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  try {
    navCounts = await getAdminNavCounts();
  } catch {
    /* use empty */
  }
  const anomalies = detectAnomaliesFromNavCounts(navCounts, {
    stalePendingPayments: metrics.stalePendingPayments,
    pendingSubmissions: metrics.pendingSubmissions,
    failedPayouts: financeIssues?.failedPayoutCount ?? 0,
  });

  const syntheticAttention = buildSyntheticAttentionRows(navCounts, role, staffRole);
  const attentionForDashboard = [...syntheticAttention, ...attention];

  if (canAccessSaleroom && isWidgetAllowed(role, staffRole, "onsite-radar")) {
    try {
      const onsiteSales = await getAdminSalesList({ limit: 12, status: "active" });
      const onsiteCandidates = onsiteSales.filter((row) =>
        isSaleroomDeliveryMode(row.sale.deliveryMode),
      );
      const snapshots = await Promise.all(
        onsiteCandidates
          .slice(0, 6)
          .map((row) => getAdminSaleOperationsSnapshot(row.sale.id).catch(() => null)),
      );
      onsiteRadarRows = snapshots
        .map((snapshot) => (snapshot ? mapOperationsSnapshotToRadarRow(snapshot) : null))
        .filter((row): row is OnsiteSalesRadarRow => row != null);
    } catch {
      /* optional widget */
    }
  }

  const activeSaleroomSessions = onsiteRadarRows.filter((row) => row.isLiveSession).length;

  return {
    metrics,
    trends,
    bidsPerMinute,
    activeLotIds,
    attention: attentionForDashboard,
    activity,
    anomalies,
    onsiteRadarRows,
    activeSaleroomSessions,
    loadWarning: dashboardLoadWarning,
    hubLinks: hubQuickLinksFor(role, staffRole),
  };
}
