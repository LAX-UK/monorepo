import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import type { ArtistScenarioParam } from "@/lib/admin/artists/load-artist-create-page";
import type { CategoryNode } from "@auction/types";

type Props = {
  categories: CategoryNode[];
  ownerUserId: string | null;
  displayName: string;
  initialScenario: ArtistScenarioParam;
};

export function ArtistCreateForm({ categories, ownerUserId, displayName }: Props) {
  return (
    <AdminArtistForm
      mode="create"
      categories={categories}
      cancelHref="/admin/artists"
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
  );
}
