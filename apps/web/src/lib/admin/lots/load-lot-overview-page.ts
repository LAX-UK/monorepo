import "server-only";

import { type AdminKpiPeriodDays, parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { type AdminLotDetailBundle, loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import {
  type AdminLotAttention,
  getAdminLotAttention,
} from "@/lib/data/http/admin-lot-attention.server";
import {
  type AdminLotDetailMetrics,
  getAdminLotDetailMetrics,
} from "@/lib/data/http/admin-lot-detail-metrics.server";
import {
  type AdminLotOverviewKpiTrends,
  getAdminLotOverviewKpiTrends,
} from "@/lib/data/http/admin-lot-overview-kpi-trends.server";
import {
  type AdminDomainEventRow,
  getAdminDomainEventsForAggregate,
} from "@/lib/data/http/admin.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import type { Lot } from "@auction/types";

export type LotOverviewPageModel = {
  lotId: string;
  auction: Lot;
  context: LotDetailContext;
  bidCount: number;
  activityEvents: readonly AdminDomainEventRow[];
  metrics: AdminLotDetailMetrics | null;
  attention: AdminLotAttention | null;
  kpiTrends: AdminLotOverviewKpiTrends | null;
  kpiPeriodDays: AdminKpiPeriodDays;
};

/** Data/composition boundary for `/admin/lots/[id]` overview tab. */
export async function loadAdminLotOverviewPage(
  lotId: string,
  periodParam?: string,
): Promise<LotOverviewPageModel> {
  const kpiPeriodDays = parseAdminKpiPeriod(periodParam);
  const bundle: AdminLotDetailBundle = await loadAdminLotDetail(lotId);

  const [bids, metrics, attention, kpiTrends, activityEvents] = await Promise.all([
    getServerLotBids(lotId, 100).catch(() => []),
    getAdminLotDetailMetrics(lotId),
    getAdminLotAttention(lotId),
    getAdminLotOverviewKpiTrends(lotId, kpiPeriodDays),
    getAdminDomainEventsForAggregate({
      aggregateType: "lot",
      aggregateId: lotId,
      limit: 100,
    }).catch(() => []),
  ]);

  return {
    lotId,
    auction: bundle.auction,
    context: bundle.context,
    bidCount: bids.length,
    activityEvents,
    metrics,
    attention,
    kpiTrends,
    kpiPeriodDays,
  };
}
