import { LegalEntityComplianceTab } from "@/components/admin/legal-entities/tabs/compliance-tab";
import { loadAdminLegalEntityCompliancePage } from "@/lib/admin/legal-entities/load-legal-entity-compliance-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLegalEntityCompliancePage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminLegalEntityCompliancePage(id);
  return <LegalEntityComplianceTab entity={page.entity} />;
}
