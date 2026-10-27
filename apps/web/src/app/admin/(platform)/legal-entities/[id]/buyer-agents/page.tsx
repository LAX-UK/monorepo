import { LegalEntityBuyerAgentsTab } from "@/components/admin/legal-entities/tabs/buyer-agents-tab";
import { loadAdminLegalEntityBuyerAgentsPage } from "@/lib/admin/legal-entities/load-legal-entity-buyer-agents-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLegalEntityBuyerAgentsPage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminLegalEntityBuyerAgentsPage(id);
  return (
    <LegalEntityBuyerAgentsTab
      entityId={page.entity.id}
      entityName={page.entity.displayName}
      overview={page.overview}
      canManage={page.canManage}
    />
  );
}
