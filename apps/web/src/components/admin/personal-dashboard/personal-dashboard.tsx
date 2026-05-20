import { AnomalyCalloutsWidget } from "@/components/admin/personal-dashboard/anomaly-callouts-widget";
import { PersonalDashboardCustomizeSheet } from "@/components/admin/personal-dashboard/customize-sheet";
import { GreetingWidget } from "@/components/admin/personal-dashboard/greeting-widget";
import { MyQueueWidget } from "@/components/admin/personal-dashboard/my-queue-widget";
import { RecentActivityWidget } from "@/components/admin/personal-dashboard/recent-activity-widget";
import { SaleroomLiveWidget } from "@/components/admin/personal-dashboard/saleroom-live-widget";
import { TrendKpiBandWidget } from "@/components/admin/personal-dashboard/trend-kpi-band-widget";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import type { AdminActivityRow, AdminAttentionRow } from "@/lib/admin/admin-home-types";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { AdminAnomaly } from "@/lib/admin/anomaly-detection";
import {
  type DashboardWidgetState,
  isDashboardWidgetVisible,
} from "@/lib/admin/dashboard-widgets.vm";
import type { AdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";
import { LabelCaps } from "@auction/ui";

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
}: Props) {
  const show = (id: DashboardWidgetState["id"]) => isDashboardWidgetVisible(widgets, id);

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        title="Your dashboard"
        meta={<LabelCaps className="text-lot-orange">Admin · Personal</LabelCaps>}
        description="Trend-aware KPIs, queue, anomalies, and saleroom pulse — layout saved on this device."
        actions={<PersonalDashboardCustomizeSheet widgets={widgets} />}
      />

      {show("greeting") ? <GreetingWidget name={userName} /> : null}

      {show("anomalies") && anomalies.length > 0 ? (
        <AnomalyCalloutsWidget anomalies={anomalies} />
      ) : null}

      {show("kpi-band") ? (
        <TrendKpiBandWidget
          periodDays={periodDays}
          metrics={metrics}
          trends={trends}
          bidsPerMinute={bidsPerMinute}
        />
      ) : null}

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

      {show("activity") ? <RecentActivityWidget activity={activity} /> : null}
    </div>
  );
}
