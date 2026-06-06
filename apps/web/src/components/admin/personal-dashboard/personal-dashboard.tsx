import { AdminHubQuickLinks } from "@/components/admin/admin-hub-quick-links";
import { AnomalyCalloutsWidget } from "@/components/admin/personal-dashboard/anomaly-callouts-widget";
import { PersonalDashboardCustomizeSheet } from "@/components/admin/personal-dashboard/customize-sheet";
import { GreetingWidget } from "@/components/admin/personal-dashboard/greeting-widget";
import { MyQueueWidget } from "@/components/admin/personal-dashboard/my-queue-widget";
import { OnsiteSalesRadarWidget } from "@/components/admin/personal-dashboard/onsite-sales-radar-widget";
import type { OnsiteSalesRadarRow } from "@/components/admin/personal-dashboard/onsite-sales-radar-widget";
import { RecentActivityWidget } from "@/components/admin/personal-dashboard/recent-activity-widget";
import { SaleroomLiveWidget } from "@/components/admin/personal-dashboard/saleroom-live-widget";
import { TrendKpiBandWidget } from "@/components/admin/personal-dashboard/trend-kpi-band-widget";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
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
import { LabelCaps } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

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
  loadWarning?: string | null;
  staffRole?: UserStaffRole | null;
};

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
  loadWarning = null,
  staffRole = null,
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
      node: show("kpi-band") ? (
        <TrendKpiBandWidget
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
                <SaleroomLiveWidget bidsPerMinute={bidsPerMinute} activeLotIds={activeLotIds} />
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
      <DashboardPageHeader
        title="Your dashboard"
        meta={<LabelCaps className="text-lot-orange">Admin · Personal</LabelCaps>}
        description="Trend-aware KPIs, queue, anomalies, and saleroom pulse — layout saved on this device."
        actions={<PersonalDashboardCustomizeSheet widgets={widgets} staffRole={staffRole} />}
      />

      {loadWarning ? (
        <Alert variant="destructive">
          <AlertTitle>Some dashboard data could not load</AlertTitle>
          <AlertDescription>{loadWarning}</AlertDescription>
        </Alert>
      ) : null}

      <AdminHubQuickLinks
        ariaLabel="Staff hub shortcuts"
        links={[
          { href: "/admin/finance", label: "Finance" },
          { href: "/admin/sales", label: "Catalog" },
          { href: "/admin/compliance/aml", label: "Compliance" },
        ]}
      />

      {blocks.map((block) => (
        <div key={block.id}>{block.node}</div>
      ))}
    </div>
  );
}
