import { AdminArtistForm } from "@/components/admin/admin-artist-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { ArtistProfile, CategoryNode } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  artist: ArtistProfile;
  categories: CategoryNode[];
  cancelHref: string;
  readOnly?: boolean;
};

export function ArtistEditForm({ artist, categories, cancelHref, readOnly = false }: Props) {
  return (
    <Surface variant="card" padding="md">
      <AdminArtistForm
        mode="edit"
        artistId={artist.id}
        slug={artist.slug}
        readOnly={readOnly}
        categories={categories}
        cancelHref={cancelHref}
        htmlFormId={CATALOG_FORM_IDS.artist}
        wizardLayout="sidebar"
        defaultValues={{
          displayName: artist.displayName,
          kind: artist.kind ?? "artist",
          status: artist.status ?? "approved",
          portraitUrl: artist.portraitUrl ?? "",
          heroImageUrl: artist.heroImageUrl ?? "",
          shortBio: artist.shortBio ?? "",
          longBio: artist.longBio ?? "",
          statement: artist.statement ?? "",
          nationality: artist.nationality ?? "",
          location: artist.location ?? "",
          countryCode: artist.countryCode ?? "",
          birthYear: artist.birthYear ?? "",
          deathYear: artist.deathYear ?? "",
          foundedYear: artist.foundedYear ?? "",
          dissolvedYear: artist.dissolvedYear ?? "",
          websiteUrl: artist.websiteUrl ?? "",
          ownerUserId: artist.ownerUserId,
          featured: artist.featured,
          verified: artist.verified,
          archived: artist.archived,
          categoryIds: (artist.categories ?? []).map((c) => c.id),
          attributes: artist.attributes ?? {},
        }}
      />
    </Surface>
  );
}
