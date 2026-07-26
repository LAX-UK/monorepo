import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import type { ArtistScenarioParam } from "@/lib/admin/artists/load-artist-create-page";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { CategoryNode } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  categories: CategoryNode[];
  ownerUserId: string | null;
  displayName: string;
  initialScenario: ArtistScenarioParam;
};

export function ArtistCreateForm({ categories, ownerUserId, displayName, initialScenario }: Props) {
  return (
    <Surface variant="card" padding="md">
      <AdminArtistForm
        mode="create"
        categories={categories}
        initialScenario={initialScenario}
        cancelHref="/admin/artists"
        htmlFormId={CATALOG_FORM_IDS.artist}
        wizardLayout="sidebar"
        defaultValues={{
          displayName,
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
    </Surface>
  );
}
