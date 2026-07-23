import { CatalogDetailActionError } from "@/components/admin/catalog";
import { SaleOverviewTab } from "@/components/admin/sale-detail/tabs/overview-tab";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { loadSaleConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import {
  loadAdminSaleDetail,
  loadAdminSalePendingRegistrationCount,
  loadAdminSaleRegistrationCount,
} from "@/lib/admin/load-sale-detail";
import { getAdminSaleAttention } from "@/lib/data/http/admin-sale-attention.server";
import { getAdminSaleDetailMetrics } from "@/lib/data/http/admin-sale-detail-metrics.server";
import { getAdminSaleOverviewKpiTrends } from "@/lib/data/http/admin-sale-overview-kpi-trends.server";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; period?: string }>;
};

export default async function AdminSaleOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const kpiPeriodDays = parseAdminKpiPeriod(sp.period);

  const bundle = await loadAdminSaleDetail(id);
  const { sale, lots } = bundle;
  const [
    registrationCount,
    pendingRegistrationCount,
    connectRequiredByLotId,
    activityEvents,
    metrics,
    attention,
    kpiTrends,
  ] = await Promise.all([
    loadAdminSaleRegistrationCount(id, sale),
    loadAdminSalePendingRegistrationCount(id, sale),
    loadSaleConnectRequiredByLotId(id),
    getAdminDomainEventsForAggregate({ aggregateType: "sale", aggregateId: id, limit: 100 }).catch(
      () => [],
    ),
    getAdminSaleDetailMetrics(id),
    getAdminSaleAttention(id),
    getAdminSaleOverviewKpiTrends(id, kpiPeriodDays),
  ]);

  return (
    <>
      <CatalogDetailActionError error={sp.error} />
      <SaleOverviewTab
        saleId={id}
        sale={sale}
        lots={lots}
        registrationCount={registrationCount}
        pendingRegistrationCount={pendingRegistrationCount}
        connectRequiredByLotId={connectRequiredByLotId}
        activityEvents={activityEvents}
        metrics={metrics}
        attention={attention}
        kpiTrends={kpiTrends}
        kpiPeriodDays={kpiPeriodDays}
      />
    </>
  );
}
