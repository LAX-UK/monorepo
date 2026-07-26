import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { LotOverviewTab } from "@/components/admin/lot-detail/tabs/overview-tab";
import { loadAdminLotOverviewPage } from "@/lib/admin/lots/load-lot-overview-page";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; error_code?: string; period?: string }>;
};

export default async function AdminLotOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const page = await loadAdminLotOverviewPage(id, sp.period);

  return (
    <>
      {sp.error && sp.error_code !== "connect_required" ? (
        <CatalogDetailActionError error={sp.error} />
      ) : null}
      <LotOverviewTab
        lotId={page.lotId}
        auction={page.auction}
        context={page.context}
        bidCount={page.bidCount}
        activityEvents={page.activityEvents}
        metrics={page.metrics}
        attention={page.attention}
        kpiTrends={page.kpiTrends}
        kpiPeriodDays={page.kpiPeriodDays}
      />
    </>
  );
}
