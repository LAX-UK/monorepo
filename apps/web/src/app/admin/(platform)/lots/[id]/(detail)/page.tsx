import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { LotOverviewTab } from "@/components/admin/lot-detail/tabs/overview-tab";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { getAdminLotAttention } from "@/lib/data/http/admin-lot-attention.server";
import { getAdminLotDetailMetrics } from "@/lib/data/http/admin-lot-detail-metrics.server";
import { getAdminLotOverviewKpiTrends } from "@/lib/data/http/admin-lot-overview-kpi-trends.server";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; error_code?: string; period?: string }>;
};

export default async function AdminLotOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const periodDays = parseAdminKpiPeriod(sp.period);

  const [bundle, bids, metrics, attention, kpiTrends, activityEvents] = await Promise.all([
    loadAdminLotDetail(id),
    getServerLotBids(id, 100).catch(() => []),
    getAdminLotDetailMetrics(id),
    getAdminLotAttention(id),
    getAdminLotOverviewKpiTrends(id, periodDays),
    getAdminDomainEventsForAggregate({
      aggregateType: "lot",
      aggregateId: id,
      limit: 100,
    }).catch(() => []),
  ]);

  return (
    <>
      {sp.error && sp.error_code !== "connect_required" ? (
        <CatalogDetailActionError error={sp.error} />
      ) : null}
      <LotOverviewTab
        lotId={id}
        auction={bundle.auction}
        context={bundle.context}
        bidCount={bids.length}
        activityEvents={activityEvents}
        metrics={metrics}
        attention={attention}
        kpiTrends={kpiTrends}
        kpiPeriodDays={periodDays}
      />
    </>
  );
}
