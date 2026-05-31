import { CatalogDetailActionError } from "@/components/admin/catalog";
import { isSaleLiveish, saleVenueLines } from "@/components/admin/sale-detail/sale-detail-helpers";
import { SaleOverviewTab } from "@/components/admin/sale-detail/tabs/overview-tab";
import { loadSaleConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import {
  loadAdminSaleDetail,
  loadAdminSalePendingRegistrationCount,
  loadAdminSaleRegistrationCount,
} from "@/lib/admin/load-sale-detail";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminSaleOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;

  const bundle = await loadAdminSaleDetail(id);
  const { sale, lots } = bundle;
  const liveish = isSaleLiveish(sale);
  const isOnsite = sale.deliveryMode === "onsite";
  const [registrationCount, pendingRegistrationCount, connectRequiredByLotId] = await Promise.all([
    loadAdminSaleRegistrationCount(id, sale),
    loadAdminSalePendingRegistrationCount(id, sale),
    loadSaleConnectRequiredByLotId(id),
  ]);

  return (
    <>
      <CatalogDetailActionError error={sp.error} />
      <SaleOverviewTab
        saleId={id}
        sale={sale}
        lots={lots}
        liveish={liveish}
        isOnsite={isOnsite}
        venueLines={saleVenueLines(sale)}
        registrationCount={registrationCount}
        pendingRegistrationCount={pendingRegistrationCount}
        connectRequiredByLotId={connectRequiredByLotId}
      />
    </>
  );
}
