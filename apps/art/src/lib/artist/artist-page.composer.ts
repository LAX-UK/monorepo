import {
  type CatalogueArtworkCardVm,
  artistHref,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import {
  loadFollowedArtistSlugs,
  loadViewerFavoriteContext,
} from "@/lib/favorites/viewer-favorites";
import type { ArtCataloguePort, ArtFavoritesReadPort, ArtViewerPort } from "@/lib/ports";
import type { PublicArtistDetail } from "@auction/shop-contracts";

export type ArtistPageVm = {
  slug: string;
  name: string;
  discipline: string | null;
  bio: string | null;
  portraitUrl: string | null;
  portraitAlt: string;
  works: CatalogueArtworkCardVm[];
  worksFailed: boolean;
  following: boolean;
  favoriteAuth: ArtFavoriteAuth;
};

export type ArtistPageResult =
  | { kind: "ok"; vm: ArtistPageVm }
  | { kind: "not_found" }
  | { kind: "unavailable" };

export async function composeArtistPage(
  services: { catalogue: ArtCataloguePort; viewer: ArtViewerPort; favorites: ArtFavoritesReadPort },
  slug: string,
): Promise<ArtistPageResult> {
  const favoritesPromise = loadViewerFavoriteContext(services, artistHref(slug)).then(
    async (context) => ({
      ...context,
      followedSlugs: await loadFollowedArtistSlugs(services.favorites, context.viewer),
    }),
  );
  const [artist, works] = await Promise.allSettled([
    services.catalogue.getArtist(slug),
    services.catalogue.listArtworks({ artistSlug: slug, limit: 24 }),
  ]);
  const favorites = await favoritesPromise;
  if (artist.status === "rejected") return { kind: "unavailable" };
  const detail: PublicArtistDetail | null = artist.value;
  if (!detail) return { kind: "not_found" };

  return {
    kind: "ok",
    vm: {
      slug: detail.slug,
      name: detail.name,
      discipline: detail.discipline,
      bio: detail.bio,
      portraitUrl: detail.portraitUrl,
      portraitAlt: `Portrait of ${detail.name}`,
      works:
        works.status === "fulfilled"
          ? buildCatalogueArtworkCards(works.value.items, favorites.savedArtworkSlugs)
          : [],
      worksFailed: works.status === "rejected",
      following: favorites.followedSlugs.has(detail.slug),
      favoriteAuth: favorites.favoriteAuth,
    },
  };
}

export async function composeArtistMetadataTitle(
  catalogue: ArtCataloguePort,
  slug: string,
): Promise<string> {
  const artist = await catalogue.getArtist(slug).catch(() => null);
  return artist ? `${artist.name} | LAX Art` : "Artist | LAX Art";
}
