import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { parseScenarioParam } from "@/components/admin/artist-form/scenario-config";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import Link from "next/link";

type Search = { ownerUserId?: string; displayName?: string; scenario?: string };

export default async function NewAdminArtistPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const ownerFromUrl = sp.ownerUserId?.trim() ?? "";
  const displayFromUrl = sp.displayName?.trim() ?? "";
  const ownerUserId = ownerFromUrl.length > 0 ? ownerFromUrl : null;
  const initialScenario = parseScenarioParam(sp.scenario?.trim());
  const categories = await (async () => {
    try {
      return await (await getServerCategoryReader()).tree();
    } catch {
      return [];
    }
  })();

  return (
    <CatalogFormShell
      className="md:max-w-4xl"
      breadcrumbs={
        <Link
          href="/admin/artists"
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
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
        initialScenario={initialScenario}
        htmlFormId={CATALOG_FORM_IDS.artist}
        categories={categories}
        defaultValues={{
          displayName: displayFromUrl,
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
          ownerUserId,
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
