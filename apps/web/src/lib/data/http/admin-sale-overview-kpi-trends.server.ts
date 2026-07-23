import "server-only";

import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { AdminKpiTrendBundle } from "@/lib/data/http/admin-kpi-trends.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type AdminSaleOverviewKpiTrends = {
  lots: AdminKpiTrendBundle;
  estimate: AdminKpiTrendBundle;
  hammer: AdminKpiTrendBundle;
  revenue: AdminKpiTrendBundle;
  registrations: AdminKpiTrendBundle;
  bidders: AdminKpiTrendBundle;
};

function emptyBundle(periodDays: AdminKpiPeriodDays): AdminKpiTrendBundle {
  return {
    currentTotal: 0,
    priorTotal: 0,
    dailyCounts: Array.from({ length: periodDays }, () => 0),
  };
}

export const EMPTY_ADMIN_SALE_OVERVIEW_KPI_TRENDS = (
  periodDays: AdminKpiPeriodDays = 30,
): AdminSaleOverviewKpiTrends => {
  const empty = emptyBundle(periodDays);
  return {
    lots: empty,
    estimate: empty,
    hammer: empty,
    revenue: empty,
    registrations: empty,
    bidders: empty,
  };
};

export async function getAdminSaleOverviewKpiTrends(
  saleId: string,
  periodDays: AdminKpiPeriodDays,
): Promise<AdminSaleOverviewKpiTrends> {
  try {
    const qs = new URLSearchParams({ periodDays: String(periodDays) });
    const res = await authedServerFetch(
      `/admin/sales/${encodeURIComponent(saleId)}/kpi-trends?${qs.toString()}`,
    );
    if (!res.ok) throw new Error(`Failed to load sale KPI trends: ${res.status}`);
    const body = (await res.json()) as { data?: AdminSaleOverviewKpiTrends };
    const data = body.data;
    if (!data) throw new Error("Missing sale KPI trends payload");
    return data;
  } catch (err) {
    console.error("[getAdminSaleOverviewKpiTrends] Failed to load sale KPI trends:", err);
    return EMPTY_ADMIN_SALE_OVERVIEW_KPI_TRENDS(periodDays);
  }
}
