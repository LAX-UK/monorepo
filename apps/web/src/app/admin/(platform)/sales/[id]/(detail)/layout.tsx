import { SaleDetailShell } from "@/components/admin/sale-detail/sale-detail-shell";
import { loadSaleConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { loadAdminSaleDetail, loadAdminSaleRegistrationCount } from "@/lib/admin/load-sale-detail";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import { SALES_ACCESS, SALE_CATALOG_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
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
  const [registrationCount, documents, activityEvents, connectRequiredByLotId] = await Promise.all([
    loadAdminSaleRegistrationCount(id, bundle.sale),
    getServerSaleDocuments(id).catch(() => []),
    getAdminDomainEventsForAggregate({ aggregateType: "sale", aggregateId: id, limit: 5 }).catch(
      () => [],
    ),
    loadSaleConnectRequiredByLotId(id),
  ]);

  return (
    <SaleDetailShell
      saleId={id}
      bundle={bundle}
      registrationCount={registrationCount}
      documentCount={documents.length}
      activityEvents={activityEvents}
      canManageSales={canManageSales}
      connectRequiredByLotId={connectRequiredByLotId}
    >
      {children}
    </SaleDetailShell>
  );
}
