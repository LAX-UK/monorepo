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

export async function getAdminSaleOverviewKpiTrends(
  saleId: string,
  periodDays: AdminKpiPeriodDays,
): Promise<AdminSaleOverviewKpiTrends | null> {
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
    // No trend rather than a row of zeros, so the overview never draws a flat line it did not load.
    return null;
  }
}
