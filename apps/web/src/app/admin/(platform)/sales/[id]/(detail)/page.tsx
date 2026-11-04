import { SaleOverviewTab } from "@/components/admin/sale-detail/tabs/overview-tab";
import { AdminCodeNotice } from "@/components/admin/staff/admin-code-notice";
import { loadAdminSaleOverviewPage } from "@/lib/admin/sales/load-sale-overview-page";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; period?: string }>;
};

export default async function AdminSaleOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const page = await loadAdminSaleOverviewPage(id, sp.period);

  return (
    <>
      <AdminCodeNotice code={sp.notice} />
      <SaleOverviewTab
        saleId={page.saleId}
        sale={page.sale}
        lots={page.lots}
        registrationCount={page.registrationCount}
        pendingRegistrationCount={page.pendingRegistrationCount}
        connectRequiredByLotId={page.connectRequiredByLotId}
        activityEvents={page.activityEvents}
        metrics={page.metrics}
        attention={page.attention}
        kpiTrends={page.kpiTrends}
        kpiPeriodDays={page.kpiPeriodDays}
      />
    </>
  );
}
