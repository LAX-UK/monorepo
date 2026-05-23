import { SaleDetailShell } from "@/components/admin/sale-detail/sale-detail-shell";
import { loadAdminSaleDetail, loadAdminSaleRegistrationCount } from "@/lib/admin/load-sale-detail";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminSaleDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const bundle = await loadAdminSaleDetail(id);
  const [registrationCount, documents, activityEvents] = await Promise.all([
    loadAdminSaleRegistrationCount(id, bundle.sale),
    getServerSaleDocuments(id).catch(() => []),
    getAdminDomainEventsForAggregate({ aggregateType: "sale", aggregateId: id, limit: 5 }).catch(
      () => [],
    ),
  ]);

  return (
    <SaleDetailShell
      saleId={id}
      bundle={bundle}
      registrationCount={registrationCount}
      documentCount={documents.length}
      activityEvents={activityEvents}
    >
      {children}
    </SaleDetailShell>
  );
}
