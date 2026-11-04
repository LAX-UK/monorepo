import { AtgLotStatus } from "@/components/admin/atg/atg-lot-status";
import { LotOverviewTab } from "@/components/admin/lot-detail/tabs/overview-tab";
import { loadAdminLotOverviewPage } from "@/lib/admin/lots/load-lot-overview-page";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
};

export default async function AdminLotOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const page = await loadAdminLotOverviewPage(id, sp.period);

  return (
    <>
      {page.atgLot ? <AtgLotStatus lot={page.atgLot} /> : null}
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
