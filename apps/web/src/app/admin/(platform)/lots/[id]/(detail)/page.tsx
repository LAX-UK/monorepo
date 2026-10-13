import { AtgLotStatus } from "@/components/admin/atg/atg-lot-status";
import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { LotOverviewTab } from "@/components/admin/lot-detail/tabs/overview-tab";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { getAtgLotSyncView } from "@/lib/data/http/atg.server";
import { getServerLotBids } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; error_code?: string }>;
};

export default async function AdminLotOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const [bundle, bids, user] = await Promise.all([
    loadAdminLotDetail(id),
    getServerLotBids(id, 100).catch(() => []),
    getServerSessionUser(),
  ]);
  const canSeeAtg =
    user != null && userHasAccessTo(user.role as UserRole, user.staffRole ?? null, SALES_ACCESS);
  const atgLot = canSeeAtg ? await getAtgLotSyncView(bundle.auction.saleId, id) : null;
  return (
    <>
      {sp.error && sp.error_code !== "connect_required" ? (
        <CatalogDetailActionError error={sp.error} />
      ) : null}
      {atgLot ? <AtgLotStatus lot={atgLot} /> : null}
      <LotOverviewTab
        lotId={id}
        auction={bundle.auction}
        context={bundle.context}
        bidCount={bids.length}
      />
    </>
  );
}
