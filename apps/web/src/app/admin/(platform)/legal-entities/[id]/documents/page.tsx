import { LegalEntityDocumentsTab } from "@/components/admin/legal-entities/legal-entity-documents-tab";
import { ADMIN_NOTICE_PARAM, resolveAdminNotice } from "@/lib/admin/admin-notice";
import { loadAdminLegalEntityDocumentsPage } from "@/lib/admin/legal-entities/load-legal-entity-documents-page";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function AdminLegalEntityDocumentsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const notice = resolveAdminNotice(sp[ADMIN_NOTICE_PARAM]);
  const page = await loadAdminLegalEntityDocumentsPage(id);

  return (
    <LegalEntityDocumentsTab
      legalEntityId={id}
      documents={page.documents}
      error={notice.error}
      success={notice.success}
    />
  );
}
