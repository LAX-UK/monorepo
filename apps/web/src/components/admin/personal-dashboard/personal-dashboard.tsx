import {
  type AdminHubQuickLink,
  AdminHubQuickLinks,
} from "@/components/admin/admin-hub-quick-links";
import { AnomalyCalloutsWidget } from "@/components/admin/personal-dashboard/anomaly-callouts-widget";
import { GreetingWidget } from "@/components/admin/personal-dashboard/greeting-widget";
import { MyQueueWidget } from "@/components/admin/personal-dashboard/my-queue-widget";
import { OnsiteSalesRadarWidget } from "@/components/admin/personal-dashboard/onsite-sales-radar-widget";
import type { OnsiteSalesRadarRow } from "@/components/admin/personal-dashboard/onsite-sales-radar-widget";
import { RecentActivityWidget } from "@/components/admin/personal-dashboard/recent-activity-widget";
import { SaleroomLiveWidget } from "@/components/admin/personal-dashboard/saleroom-live-widget";
import { TrendKpiBandWidget } from "@/components/admin/personal-dashboard/trend-kpi-band-widget";
import type { AdminActivityRow, AdminAttentionRow } from "@/lib/admin/admin-home-types";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { AdminAnomaly } from "@/lib/admin/anomaly-detection";
import {
  type DashboardWidgetId,
  type DashboardWidgetState,
  isDashboardWidgetVisible,
} from "@/lib/admin/dashboard-widgets.vm";
import type { AdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";
import type { UserStaffRole } from "@auction/types";

type Props = {
  userName: string;
  periodDays: AdminKpiPeriodDays;
  widgets: readonly DashboardWidgetState[];
  metrics: AdminTodayMetricsPayload;
  trends: AdminHomeKpiTrends;
  bidsPerMinute: number;
  activeLotIds: readonly string[];
  attention: readonly AdminAttentionRow[];
  activity: readonly AdminActivityRow[];
  anomalies: readonly AdminAnomaly[];
  onsiteRadarRows?: readonly OnsiteSalesRadarRow[];
  activeSaleroomSessions?: number;
  staffRole?: UserStaffRole | null;
  hubLinks?: readonly AdminHubQuickLink[];
  /** When false, KPI band is rendered by StaffHubShell `kpiStrip`. */
  includeKpiBand?: boolean;
};

export function PersonalDashboardKpiBand({
  periodDays,
  metrics,
  trends,
  bidsPerMinute,
}: Pick<Props, "periodDays" | "metrics" | "trends" | "bidsPerMinute">) {
  return (
    <TrendKpiBandWidget
      periodDays={periodDays}
      metrics={metrics}
      trends={trends}
      bidsPerMinute={bidsPerMinute}
    />
  );
}

export function PersonalDashboard({
  userName,
  periodDays,
  widgets,
  metrics,
  trends,
  bidsPerMinute,
  activeLotIds,
  attention,
  activity,
  anomalies,
  onsiteRadarRows = [],
  activeSaleroomSessions = 0,
  staffRole: _staffRole = null,
  hubLinks = [],
  includeKpiBand = true,
}: Props) {
  const show = (id: DashboardWidgetState["id"]) => isDashboardWidgetVisible(widgets, id);
  const orderOf = (id: DashboardWidgetId) => widgets.find((w) => w.id === id)?.order ?? 999;
  const blocks = [
    {
      id: "greeting",
      order: orderOf("greeting"),
      node: show("greeting") ? <GreetingWidget name={userName} /> : null,
    },
    {
      id: "anomalies",
      order: orderOf("anomalies"),
      node:
        show("anomalies") && anomalies.length > 0 ? (
          <AnomalyCalloutsWidget anomalies={anomalies} />
        ) : null,
    },
    {
      id: "kpi-band",
      order: orderOf("kpi-band"),
      node:
        includeKpiBand && show("kpi-band") ? (
          <PersonalDashboardKpiBand
            periodDays={periodDays}
            metrics={metrics}
            trends={trends}
            bidsPerMinute={bidsPerMinute}
          />
        ) : null,
    },
    {
      id: "queue-saleroom",
      order: Math.min(orderOf("my-queue"), orderOf("saleroom-live")),
      node:
        show("my-queue") || show("saleroom-live") ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {show("my-queue") ? (
              <section className="lg:col-span-7">
                <MyQueueWidget attention={attention} />
              </section>
            ) : null}
            {show("saleroom-live") ? (
              <aside className={show("my-queue") ? "lg:col-span-5" : "lg:col-span-12"}>
                <SaleroomLiveWidget
                  bidsPerMinute={bidsPerMinute}
                  activeLotIds={activeLotIds}
                  activeSaleroomSessions={activeSaleroomSessions}
                />
              </aside>
            ) : null}
          </div>
        ) : null,
    },
    {
      id: "onsite-radar",
      order: orderOf("onsite-radar"),
      node:
        show("onsite-radar") && onsiteRadarRows.length > 0 ? (
          <OnsiteSalesRadarWidget rows={[...onsiteRadarRows]} />
        ) : null,
    },
    {
      id: "activity",
      order: orderOf("activity"),
      node: show("activity") ? <RecentActivityWidget activity={activity} /> : null,
    },
  ]
    .filter((block) => block.node)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-8">
      {hubLinks.length > 0 ? (
        <AdminHubQuickLinks ariaLabel="Staff hub shortcuts" links={hubLinks} />
      ) : null}

      {blocks.map((block) => (
        <div key={block.id}>{block.node}</div>
      ))}
    </div>
  );
}
