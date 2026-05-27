import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { LotOverviewTab } from "@/components/admin/lot-detail/tabs/overview-tab";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { getServerLotBids } from "@/lib/data/http/lots.server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; error_code?: string }>;
};

export default async function AdminLotOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const [bundle, bids] = await Promise.all([
    loadAdminLotDetail(id),
    getServerLotBids(id, 100).catch(() => []),
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
      />
    </>
  );
}
