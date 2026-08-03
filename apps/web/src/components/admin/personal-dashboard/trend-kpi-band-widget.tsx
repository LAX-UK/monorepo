import { InstrumentedTrendKpiBand } from "@/components/admin/personal-dashboard/instrumented-trend-kpi-band";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { buildDashboardKpiTiles } from "@/lib/admin/build-dashboard-kpi-tiles";
import type { RoleKpiDefinitionId } from "@/lib/admin/dashboard/role-kpis.slice";
import type { RoleKpisSlice } from "@/lib/admin/dashboard/role-kpis.slice";
import type { AdminHomeKpiTrends } from "@/lib/data/http/admin-kpi-trends.server";
import type { AdminTodayMetricsPayload } from "@/lib/data/http/admin.server";

type Props = {
  periodDays: AdminKpiPeriodDays;
  metrics: AdminTodayMetricsPayload;
  trends: AdminHomeKpiTrends;
  bidsPerMinute: number;
  roleKpis?: RoleKpisSlice;
  profileId: string;
  anomalyTones?: Partial<Record<RoleKpiDefinitionId, "warning">>;
};

export function TrendKpiBandWidget({
  periodDays,
  metrics,
  trends,
  bidsPerMinute,
  roleKpis,
  profileId,
  anomalyTones = {},
}: Props) {
  const tiles = buildDashboardKpiTiles({
    periodDays,
    metrics,
    trends,
    bidsPerMinute,
    roleKpis,
    anomalyTones,
  });

  return (
    <InstrumentedTrendKpiBand
      profileId={profileId}
      tiles={tiles}
      ariaLabel={roleKpis?.status === "ready" ? "Role KPI trends" : "Operations trends"}
    />
  );
}
