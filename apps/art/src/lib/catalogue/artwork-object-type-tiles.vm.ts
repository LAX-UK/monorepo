import {
  ARTWORK_OBJECT_TYPE_LABELS,
  type ArtworkCatalogueUrlState,
  artworkCatalogueFilterHref,
} from "@/lib/catalogue/artwork-catalogue-params";
import type { PublicArtworkObjectTypeFacet } from "@auction/shop-contracts";

export type ArtworkObjectTypeTileVm = {
  objectType: PublicArtworkObjectTypeFacet["objectType"];
  label: string;
  countLabel: string;
  imageUrl: string | null;
  /** Applies the medium; on the active tile it clears it again. */
  href: string;
  active: boolean;
};

/** Medium tiles above the artworks grid; hidden when fewer than two media have works. */
export function buildArtworkObjectTypeTiles(
  facets: readonly PublicArtworkObjectTypeFacet[],
  state: ArtworkCatalogueUrlState,
): ArtworkObjectTypeTileVm[] {
  if (facets.length < 2) return [];
  return facets.map((facet) => {
    const active = state.objectType === facet.objectType;
    return {
      objectType: facet.objectType,
      label: ARTWORK_OBJECT_TYPE_LABELS[facet.objectType],
      countLabel: `${facet.artworkCount} work${facet.artworkCount === 1 ? "" : "s"}`,
      imageUrl: facet.coverImageUrl,
      href: artworkCatalogueFilterHref(state, { objectType: active ? null : facet.objectType }),
      active,
    };
  });
}
