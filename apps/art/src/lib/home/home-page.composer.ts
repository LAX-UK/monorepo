import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import {
  type CatalogueArtworkCardVm,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import { type EditorialCardVm, buildPlacementCards } from "@/lib/editorial/editorial-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type {
  ArtCataloguePort,
  ArtEditorialPort,
  ArtFavoritesReadPort,
  ArtViewerPort,
} from "@/lib/ports";

export type ArtHomeSection = "artworks" | "artists";

export const HERO_HEADLINE = "Original works and gallery-led sales";

export type ArtHomeEditorialVm =
  | { kind: "hidden" }
  | {
      kind: "ok";
      hero: EditorialCardVm | null;
      whatsOn: EditorialCardVm[];
      stories: EditorialCardVm[];
      guide: EditorialCardVm[];
    }
  | { kind: "failed" };

export type ArtHomePageVm = {
  featuredArtworks: CatalogueArtworkCardVm[];
  featuredArtists: CatalogueArtistCardVm[];
  favoriteAuth: ArtFavoriteAuth;
  editorial: ArtHomeEditorialVm;
  /** Sections whose upstream read failed; the page shows an inline error instead. */
  sectionErrors: ArtHomeSection[];
};

/** Home placements are curated in Shop admin and may hold no Art-channel items yet. */
async function curatedOrNewest<T extends { items: readonly unknown[] }>(
  curated: () => Promise<T>,
  newest: () => Promise<T>,
): Promise<T> {
  const result = await curated();
  return result.items.length > 0 ? result : newest();
}

export async function composeArtHomePage(services: {
  catalogue: ArtCataloguePort;
  viewer: ArtViewerPort;
  favorites: ArtFavoritesReadPort;
  editorial: Pick<ArtEditorialPort, "home">;
}): Promise<ArtHomePageVm> {
  const favoritesPromise = loadViewerFavoriteContext(services, "/");
  const editorialPromise = services.editorial.home();
  const [artworks, artists] = await Promise.allSettled([
    curatedOrNewest(
      () =>
        services.catalogue.listArtworks({
          limit: 8,
          placement: "featured_originals",
          type: "original",
        }),
      () => services.catalogue.listArtworks({ limit: 8, type: "original" }),
    ),
    curatedOrNewest(
      () => services.catalogue.listArtists({ limit: 6, placement: "featured_artists" }),
      () => services.catalogue.listArtists({ limit: 6 }),
    ),
  ]);
  const [favorites, editorialResult] = await Promise.all([favoritesPromise, editorialPromise]);

  const editorial: ArtHomeEditorialVm =
    editorialResult.status === "disabled"
      ? { kind: "hidden" }
      : editorialResult.status === "ok"
        ? {
            kind: "ok",
            hero:
              buildPlacementCards(editorialResult.data.placements, "home_hero", HERO_HEADLINE)[0] ??
              null,
            whatsOn: buildPlacementCards(
              editorialResult.data.placements,
              "home_whats_on",
              "What's on",
            ),
            stories: buildPlacementCards(editorialResult.data.placements, "home_stories", "Story"),
            guide: buildPlacementCards(editorialResult.data.placements, "home_guide", "Guide"),
          }
        : { kind: "failed" };

  const sectionErrors: ArtHomeSection[] = [];
  if (artworks.status === "rejected") sectionErrors.push("artworks");
  if (artists.status === "rejected") sectionErrors.push("artists");

  return {
    featuredArtworks:
      artworks.status === "fulfilled"
        ? buildCatalogueArtworkCards(artworks.value.items, favorites.savedArtworkSlugs)
        : [],
    featuredArtists:
      artists.status === "fulfilled" ? buildCatalogueArtistCards(artists.value.items) : [],
    favoriteAuth: favorites.favoriteAuth,
    editorial,
    sectionErrors,
  };
}
