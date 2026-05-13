import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { parseScenarioParam } from "@/components/admin/artist-form/scenario-config";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { Card, CardContent } from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";

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
    <AppScreen className="space-y-6">
      <PageHeader
        title="New artist"
        description="Create a canonical catalogue profile. Choose catalogue-only (historical or external names) or a maker–seller linked to a platform user."
      />
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
    </AppScreen>
  );
}
