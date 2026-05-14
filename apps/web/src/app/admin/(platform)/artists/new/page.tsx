import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { AdminEntityFormShell } from "@/components/admin/admin-entity-form-shell";
import { parseScenarioParam } from "@/components/admin/artist-form/scenario-config";
import { Card, CardContent } from "@auction/ui/components/card";
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
    <AdminEntityFormShell
      breadcrumbs={
        <Link
          href="/admin/artists"
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
        >
          ← Artists
        </Link>
      }
      title="New artist"
      description="Create a canonical catalogue profile. Choose catalogue-only (historical or external names) or a maker–seller linked to a platform user."
    >
      <Card>
        <CardContent className="pt-6">
          <AdminArtistForm
            mode="create"
            initialScenario={initialScenario}
            defaultValues={{
              displayName: displayFromUrl,
              slug: "",
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
        </CardContent>
      </Card>
    </AdminEntityFormShell>
  );
}
