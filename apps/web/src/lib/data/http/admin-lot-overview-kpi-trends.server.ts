import "server-only";

import type { AdminKpiTrendBundle } from "@/lib/data/http/admin-kpi-trends.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type AdminLotOverviewKpiTrends = {
  hammer: AdminKpiTrendBundle;
  bids: AdminKpiTrendBundle;
  bidders: AdminKpiTrendBundle;
};

const EMPTY_TREND: AdminKpiTrendBundle = { currentTotal: 0, priorTotal: 0, dailyCounts: [] };

export const EMPTY_ADMIN_LOT_OVERVIEW_KPI_TRENDS: AdminLotOverviewKpiTrends = {
  hammer: EMPTY_TREND,
  bids: EMPTY_TREND,
  bidders: EMPTY_TREND,
};

export async function getAdminLotOverviewKpiTrends(
  lotId: string,
  periodDays: number,
): Promise<AdminLotOverviewKpiTrends> {
  try {
    const res = await authedServerFetch(
      `/admin/lots/${encodeURIComponent(lotId)}/overview-kpi-trends?periodDays=${periodDays}`,
    );
    if (!res.ok) throw new Error(`Failed to load lot KPI trends: ${res.status}`);
    const body = (await res.json()) as { data?: AdminLotOverviewKpiTrends };
    const data = body.data;
    if (!data) throw new Error("Missing lot KPI trends payload");
    return data;
  } catch (err) {
    console.error("[getAdminLotOverviewKpiTrends] Failed to load lot KPI trends:", err);
    return EMPTY_ADMIN_LOT_OVERVIEW_KPI_TRENDS;
  }
}
