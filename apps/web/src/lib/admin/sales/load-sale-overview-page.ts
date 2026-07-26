import "server-only";

import { type AdminKpiPeriodDays, parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import {
  type ConnectRequiredByLotId,
  loadSaleConnectRequiredByLotId,
} from "@/lib/admin/connect-readiness";
import {
  loadAdminSaleDetail,
  loadAdminSalePendingRegistrationCount,
  loadAdminSaleRegistrationCount,
} from "@/lib/admin/load-sale-detail";
import {
  type AdminSaleAttention,
  getAdminSaleAttention,
} from "@/lib/data/http/admin-sale-attention.server";
import {
  type AdminSaleDetailMetrics,
  getAdminSaleDetailMetrics,
} from "@/lib/data/http/admin-sale-detail-metrics.server";
import {
  type AdminSaleOverviewKpiTrends,
  getAdminSaleOverviewKpiTrends,
} from "@/lib/data/http/admin-sale-overview-kpi-trends.server";
import {
  type AdminDomainEventRow,
  type AdminSaleListRow,
  getAdminDomainEventsForAggregate,
} from "@/lib/data/http/admin.server";
import type { Lot, Sale } from "@auction/types";

export type SaleOverviewPageModel = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  registrationCount: number | null;
  pendingRegistrationCount: number | null;
  connectRequiredByLotId: ConnectRequiredByLotId;
  activityEvents: readonly AdminDomainEventRow[];
  metrics: AdminSaleDetailMetrics | null;
  attention: AdminSaleAttention | null;
  kpiTrends: AdminSaleOverviewKpiTrends | null;
  kpiPeriodDays: AdminKpiPeriodDays;
};

/** Data/composition boundary for `/admin/sales/[id]` overview tab. */
export async function loadAdminSaleOverviewPage(
  saleId: string,
  periodParam?: string,
): Promise<SaleOverviewPageModel> {
  const kpiPeriodDays = parseAdminKpiPeriod(periodParam);
  const bundle: AdminSaleListRow = await loadAdminSaleDetail(saleId);
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
    loadAdminSaleRegistrationCount(saleId, sale),
    loadAdminSalePendingRegistrationCount(saleId, sale),
    loadSaleConnectRequiredByLotId(saleId),
    getAdminDomainEventsForAggregate({
      aggregateType: "sale",
      aggregateId: saleId,
      limit: 100,
    }).catch(() => []),
    getAdminSaleDetailMetrics(saleId),
    getAdminSaleAttention(saleId),
    getAdminSaleOverviewKpiTrends(saleId, kpiPeriodDays),
  ]);

  return {
    saleId,
    sale,
    lots,
    registrationCount,
    pendingRegistrationCount,
    connectRequiredByLotId,
    activityEvents,
    metrics,
    attention,
    kpiTrends,
    kpiPeriodDays,
  };
}
