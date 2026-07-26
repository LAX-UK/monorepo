import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { loadAdminArtistCreatePage } from "@/lib/admin/artists/load-artist-create-page";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import Link from "next/link";

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
      className="md:max-w-4xl"
      breadcrumbs={
        <Link
          href="/admin/artists"
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
        >
          ← Artists
        </Link>
      }
      title="New artist"
      description="Create a canonical catalogue profile. Choose catalogue-only (historical or external names) or a maker–seller linked to a platform user."
      wizardMobile={{
        formId: CATALOG_FORM_IDS.artist,
        submitLabel: "Create artist",
        cancelHref: "/admin/artists",
      }}
    >
      <AdminArtistForm
        mode="create"
        initialScenario={page.initialScenario}
        htmlFormId={CATALOG_FORM_IDS.artist}
        categories={page.categories}
        defaultValues={{
          displayName: page.displayName,
          kind: "artist",
          status: "approved",
          portraitUrl: "",
          heroImageUrl: "",
          shortBio: "",
          longBio: "",
          statement: "",
          nationality: "",
          location: "",
          countryCode: "",
          birthYear: "",
          deathYear: "",
          foundedYear: "",
          dissolvedYear: "",
          websiteUrl: "",
          ownerUserId: page.ownerUserId,
          featured: false,
          verified: false,
          archived: false,
          categoryIds: [],
          attributes: {},
        }}
      />
    </CatalogFormShell>
  );
}
