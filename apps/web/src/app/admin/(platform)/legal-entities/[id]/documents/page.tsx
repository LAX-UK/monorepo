import { LegalEntityDocumentsTab } from "@/components/admin/legal-entities/legal-entity-documents-tab";
import { loadAdminLegalEntityDocumentsPage } from "@/lib/admin/legal-entities/load-legal-entity-documents-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AdminLegalEntityDocumentsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const page = await loadAdminLegalEntityDocumentsPage(id);

  return (
    <LegalEntityDocumentsTab
      legalEntityId={id}
      documents={page.documents}
      error={safeDecodeAdminErrorParam(sp.error)}
      success={safeDecodeAdminErrorParam(sp.success)}
    />
  );
}
