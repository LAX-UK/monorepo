import { AdminLotConnectRequiredBanner } from "@/components/admin/admin-lot-connect-required-banner";
import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { LotOverviewTab } from "@/components/admin/lot-detail/tabs/overview-tab";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; error_code?: string }>;
};

export default async function AdminLotOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await loadAdminLotDetail(id);
  const errorDetail = safeDecodeAdminErrorParam(sp.error);

  return (
    <>
      {sp.error_code === "connect_required" ? (
        <AdminLotConnectRequiredBanner
          sellerLegalEntityId={bundle.auction.sellerLegalEntityId ?? null}
          detail={errorDetail}
        />
      ) : (
        <CatalogDetailActionError error={sp.error} />
      )}
      <LotOverviewTab lotId={id} auction={bundle.auction} context={bundle.context} />
    </>
  );
}
