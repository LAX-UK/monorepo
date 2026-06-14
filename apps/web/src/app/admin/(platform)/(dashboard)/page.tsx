import {
  type OnsiteSalesRadarRow,
  mapOperationsSnapshotToRadarRow,
} from "@/components/admin/personal-dashboard/onsite-sales-radar-widget";
import { PersonalDashboard } from "@/components/admin/personal-dashboard/personal-dashboard";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import type { AdminActivityRow, AdminAttentionRow } from "@/lib/admin/admin-home-types";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import { buildSyntheticAttentionRows } from "@/lib/admin/build-synthetic-attention-rows";
import {
  allowedDashboardWidgets,
  canAccess,
  hubQuickLinksFor,
  isWidgetAllowed,
} from "@/lib/admin/dashboard-access";
import {
  ADMIN_DASHBOARD_WIDGETS_COOKIE,
  parseDashboardWidgetsCookie,
} from "@/lib/admin/dashboard-widgets.vm";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
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
import { cookies } from "next/headers";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const periodDays = parseAdminKpiPeriod(sp.period);
  const user = await requireAuthenticatedUser({ shell: "staff", loginNext: "/admin" });
  const jar = await cookies();

  const role = (user.role ?? "staff") as UserRole;
  const staffRole = (user.staffRole ?? null) as UserStaffRole | null;

  const can = (req: Parameters<typeof canAccess>[2]) => canAccess(role, staffRole, req);

  const canAccessLots = can(LOTS_ACCESS);
  const canAccessFinance = can(FINANCE_ACCESS);
  const canAccessSaleroom = can(SALEROOM_ACCESS);

  const rawWidgets = parseDashboardWidgetsCookie(
    jar.get(ADMIN_DASHBOARD_WIDGETS_COOKIE)?.value,
    staffRole,
  );
  const widgets = allowedDashboardWidgets(role, staffRole, rawWidgets);

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

  const activity: AdminActivityRow[] = recentLots.slice(0, 10).map((l) => {
    const statusTone =
      l.status === "active"
        ? "live"
        : l.status === "ended"
          ? "neutral"
          : l.status === "scheduled"
            ? "warning"
            : "neutral";
    return {
      id: l.id,
      title: l.title,
      meta: `${l.status} · ends ${formatDateTime(l.endTime)}`,
      href: `/admin/lots/${l.id}`,
      statusLabel: l.status,
      statusTone,
      priceLabel: formatMoney(l.currentPrice),
      endsLabel: formatDateTime(l.endTime),
    };
  });

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

  const hubLinks = hubQuickLinksFor(role, staffRole);

  return (
    <AppScreen>
      <PersonalDashboard
        userName={user.name}
        periodDays={periodDays}
        widgets={widgets}
        metrics={metrics}
        trends={trends}
        bidsPerMinute={bidsPerMinute}
        activeLotIds={activeLotIds}
        attention={attentionForDashboard}
        activity={activity}
        anomalies={anomalies}
        onsiteRadarRows={onsiteRadarRows}
        loadWarning={dashboardLoadWarning}
        staffRole={staffRole}
        hubLinks={hubLinks}
      />
    </AppScreen>
  );
}
