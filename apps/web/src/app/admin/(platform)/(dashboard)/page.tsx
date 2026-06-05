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
  const widgets = parseDashboardWidgetsCookie(jar.get(ADMIN_DASHBOARD_WIDGETS_COOKIE)?.value);

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

  try {
    const [m, live, active, feed, recent, trendBundle] = await Promise.all([
      getAdminMetricsToday(),
      getAdminMetricsLive(),
      getAdminLotList({ status: "active", limit: 20, sort: "endingAsc" }),
      getAdminAttentionFeed(),
      getAdminLotList({ limit: 12, sort: "endingAsc" }),
      getAdminHomeKpiTrends(periodDays),
    ]);
    metrics = m;
    bidsPerMinute = live.bidsPerMinute;
    activeLotIds = active.map((a) => a.id);
    attention = feed.map((item) => ({
      id: item.id,
      title: item.title,
      hint: item.hint,
      href: item.kind === "lot_draft_past_start" ? "/admin/lots?lens=attention" : item.href,
      ctaLabel: item.ctaLabel ?? "Open",
    }));
    recentLots = recent;
    trends = trendBundle;
  } catch (e) {
    dashboardLoadWarning =
      e instanceof Error ? e.message : "Could not load all dashboard overview data.";
  }

  try {
    financeIssues = await getAdminFinanceIssues();
  } catch (e) {
    dashboardLoadWarning ??=
      e instanceof Error ? e.message : "Could not load finance dashboard alerts.";
    financeIssues = null;
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

  const syntheticAttention = buildSyntheticAttentionRows(navCounts);
  const attentionForDashboard = [...syntheticAttention, ...attention];

  try {
    const onsiteSales = await getAdminSalesList({ limit: 12, status: "active" });
    const onsiteCandidates = onsiteSales.filter((row) => row.sale.deliveryMode === "onsite");
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
      />
    </AppScreen>
  );
}
