import { LegalEntitySalesTab } from "@/components/admin/legal-entities/tabs/sales-tab";
import { loadAdminLegalEntitySalesPage } from "@/lib/admin/legal-entities/load-legal-entity-sales-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLegalEntitySalesPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminLegalEntitySalesPage(id);
  return <LegalEntitySalesTab entityId={page.entityId} displayName={page.displayName} />;
}
