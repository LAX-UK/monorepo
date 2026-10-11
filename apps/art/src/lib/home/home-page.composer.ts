import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import {
  type CatalogueArtworkCardVm,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type { ArtCataloguePort, ArtFavoritesReadPort, ArtViewerPort } from "@/lib/ports";

export type ArtHomeSection = "artworks" | "artists";

export type ArtHomePageVm = {
  featuredArtworks: CatalogueArtworkCardVm[];
  featuredArtists: CatalogueArtistCardVm[];
  favoriteAuth: ArtFavoriteAuth;
  /** Sections whose upstream read failed; the page shows an inline error instead. */
  sectionErrors: ArtHomeSection[];
};

export async function composeArtHomePage(services: {
  catalogue: ArtCataloguePort;
  viewer: ArtViewerPort;
  favorites: ArtFavoritesReadPort;
}): Promise<ArtHomePageVm> {
  const favoritesPromise = loadViewerFavoriteContext(services, "/");
  const [artworks, artists] = await Promise.allSettled([
    services.catalogue.listArtworks({
      limit: 8,
      placement: "featured_originals",
      type: "original",
    }),
    services.catalogue.listArtists({ limit: 6, placement: "featured_artists" }),
  ]);
  const favorites = await favoritesPromise;

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
    sectionErrors,
  };
}
