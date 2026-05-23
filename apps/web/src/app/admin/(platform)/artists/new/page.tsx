import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { parseScenarioParam } from "@/components/admin/artist-form/scenario-config";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { Surface } from "@auction/ui/components/surface";
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
      mobileActions={[
        {
          id: "save",
          label: "Create artist",
          variant: "primary",
          htmlForm: CATALOG_FORM_IDS.artist,
        },
        {
          id: "cancel",
          label: "Cancel",
          variant: "secondary",
          href: "/admin/artists",
        },
      ]}
    >
      <Surface variant="card">
        <div className="pt-6">
          <AdminArtistForm
            mode="create"
            initialScenario={initialScenario}
            htmlFormId={CATALOG_FORM_IDS.artist}
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
              birthYear: "",
              deathYear: "",
              websiteUrl: "",
              ownerUserId,
              featured: false,
              verified: false,
              archived: false,
            }}
          />
        </div>
      </Surface>
    </CatalogFormShell>
  );
}
