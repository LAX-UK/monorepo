import { isSaleLiveish } from "@/components/admin/sale-detail/sale-detail-helpers";
import { SaleDetailShell } from "@/components/admin/sale-detail/sale-detail-shell";
import { computeSaleDetailReadiness } from "@/lib/admin/compute-sale-detail-readiness";
import { loadSaleConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { countSaleOverviewAttentionRows } from "@/lib/admin/detail-board/merge-sale-overview-attention";
import {
  loadAdminSaleDetail,
  loadAdminSalePendingRegistrationCount,
  loadAdminSaleRegistrationCount,
} from "@/lib/admin/load-sale-detail";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAdminExpectedGuests } from "@/lib/data/http/admin-expected-guests.server";
import { getAdminSaleAttention } from "@/lib/data/http/admin-sale-attention.server";
import { getAdminTelephoneBookings } from "@/lib/data/http/admin.server";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import { buildSaleOverviewAttentionRows } from "@/lib/data/view-models/sale-overview.vm";
import { SALES_ACCESS, SALE_CATALOG_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminSaleDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const user = await requireAdminCapability(SALE_CATALOG_ACCESS, `/admin/sales/${id}`);
  const canManageSales = userHasAccessTo(
    user.role as UserRole,
    user.staffRole ?? null,
    SALES_ACCESS,
  );
  const bundle = await loadAdminSaleDetail(id);
  const isSaleroom = isSaleroomDeliveryMode(bundle.sale.deliveryMode);
  const [
    registrationCount,
    pendingRegistrationCount,
    documents,
    connectRequiredByLotId,
    pendingTelephoneBookings,
    attention,
  ] = await Promise.all([
    loadAdminSaleRegistrationCount(id, bundle.sale),
    loadAdminSalePendingRegistrationCount(id, bundle.sale),
    getServerSaleDocuments(id).catch(() => []),
    loadSaleConnectRequiredByLotId(id),
    isSaleroom ? getAdminTelephoneBookings(id, "requested").catch(() => []) : Promise.resolve([]),
    getAdminSaleAttention(id).catch(() => null),
  ]);
  const liveish = isSaleLiveish(bundle.sale);
  const pendingRegs =
    liveish && pendingRegistrationCount != null && pendingRegistrationCount > 0
      ? pendingRegistrationCount
      : null;
  const draftSetupReadiness = computeSaleDetailReadiness({
    saleId: id,
    sale: bundle.sale,
    lots: bundle.lots,
    pendingRegistrationCount: pendingRegs,
    connectRequiredByLotId,
  });

  const deleteBlockers =
    bundle.sale.status === "draft" || bundle.sale.status === "scheduled"
      ? (bundle.deleteEligibility?.blockers ?? [])
      : [];
  const overviewAttentionCount = countSaleOverviewAttentionRows(
    buildSaleOverviewAttentionRows({
      saleId: id,
      readiness: draftSetupReadiness,
      deleteBlockers,
      pendingRegistrationCount: pendingRegs,
      attention,
    }),
  );

  const linkedEvent =
    isSaleroom && liveish ? await getAdminExpectedGuests(id).catch(() => null) : null;

  return (
    <SaleDetailShell
      saleId={id}
      bundle={bundle}
      registrationCount={registrationCount}
      pendingRegistrationCount={pendingRegistrationCount}
      pendingTelephoneBookingCount={pendingTelephoneBookings.length}
      documentCount={documents.length}
      canManageSales={canManageSales}
      connectRequiredByLotId={connectRequiredByLotId}
      draftSetupReadiness={draftSetupReadiness}
      overviewAttentionCount={overviewAttentionCount}
      linkedEventSlug={linkedEvent?.eventSlug ?? null}
      linkedEventTitle={linkedEvent?.eventTitle ?? null}
    >
      {children}
    </SaleDetailShell>
  );
}
