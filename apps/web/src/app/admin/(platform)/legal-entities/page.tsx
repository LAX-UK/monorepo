import { LegalEntitiesStaffList } from "@/components/admin/legal-entities/legal-entities-staff-list";
import {
  type LegalEntitiesListSearch,
  legalEntityPanelRedirect,
} from "@/lib/admin/people/legal-entities-staff-list.vm";
import { loadAdminLegalEntitiesListPage } from "@/lib/admin/people/load-legal-entities-list-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Legal entities",
  "Browse organisation and selling entity records.",
);

export default async function AdminLegalEntitiesPage({
  searchParams,
}: {
  searchParams: Promise<LegalEntitiesListSearch>;
}) {
  const sp = await searchParams;
  // The entity panel is gone: an old shared `?entity=` link opens the entity's page.
  const panelRedirect = legalEntityPanelRedirect(sp);
  if (panelRedirect) redirect(panelRedirect);
  const page = await loadAdminLegalEntitiesListPage(sp);

  return (
    <LegalEntitiesStaffList
      search={page.search}
      view={page.view}
      sort={page.sort}
      rows={page.rows}
      summary={page.summary}
      pageSize={page.pageSize}
      pagination={page.pagination}
      loadError={page.loadError}
    />
  );
}
