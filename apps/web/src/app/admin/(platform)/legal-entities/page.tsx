import { LegalEntitiesStaffList } from "@/components/admin/legal-entities/legal-entities-staff-list";
import type { LegalEntitiesListSearch } from "@/lib/admin/people/legal-entities-staff-list.vm";
import { loadAdminLegalEntitiesListPage } from "@/lib/admin/people/load-legal-entities-list-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Legal entities",
  "Browse organisation and selling entity records.",
);

export default async function AdminLegalEntitiesPage({
  searchParams,
}: {
  searchParams: Promise<LegalEntitiesListSearch>;
}) {
  const page = await loadAdminLegalEntitiesListPage(await searchParams);

  return (
    <LegalEntitiesStaffList
      search={page.search}
      view={page.view}
      rows={page.rows}
      summary={page.summary}
      preview={page.preview}
      selectedEntityId={page.selectedEntityId}
      pageSize={page.pageSize}
      pagination={page.pagination}
      loadError={page.loadError}
    />
  );
}
