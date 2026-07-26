import { ArtistCreateForm } from "@/components/admin/artist-detail/artist-create-form";
import { CatalogBreadcrumbs, CatalogFormShell } from "@/components/admin/catalog";
import { loadAdminArtistCreatePage } from "@/lib/admin/artists/load-artist-create-page";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";

type Search = { ownerUserId?: string; displayName?: string; scenario?: string };

export default async function NewAdminArtistPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = await loadAdminArtistCreatePage(sp);

  return (
    <CatalogFormShell
      layout="wizard"
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Artists", href: "/admin/artists" }, { label: "New" }]}
        />
      }
      title="New artist"
      description="Create a canonical catalogue profile. Choose catalogue-only (historical or external names) or a maker–seller linked to a platform user."
      wizardMobile={{
        formId: CATALOG_FORM_IDS.artist,
        submitLabel: "Create artist",
        cancelHref: "/admin/artists",
      }}
    >
      <ArtistCreateForm
        categories={page.categories}
        ownerUserId={page.ownerUserId}
        displayName={page.displayName}
        initialScenario={page.initialScenario}
      />
    </CatalogFormShell>
  );
}
