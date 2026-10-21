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
import { artistJsonLd } from "@/lib/seo/art-structured-data";
import { seoMetadataDescription, seoMetadataTitle } from "@/lib/seo/seo-metadata";
import type { JsonLd } from "@auction/branding";
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
  structuredData: JsonLd[];
};

export type ArtistPageResult =
  | { kind: "ok"; vm: ArtistPageVm }
  | { kind: "not_found" }
  | { kind: "unavailable" };

export async function composeArtistPage(
  services: { catalogue: ArtCataloguePort; viewer: ArtViewerPort; favorites: ArtFavoritesReadPort },
  slug: string,
  siteUrl: URL,
): Promise<ArtistPageResult> {
  const favoritesPromise = loadViewerFavoriteContext(services, artistHref(slug)).then(
    async (context) => ({
      ...context,
      followedSlugs: await loadFollowedArtistSlugs(services.favorites, context.viewer),
    }),
  );
  const [artist, works] = await Promise.allSettled([
    services.catalogue.getArtist(slug),
    services.catalogue.listArtworks({ artistSlugs: [slug], limit: 24 }),
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
      structuredData: artistJsonLd(detail, siteUrl),
    },
  };
}

export type ArtistMetadataVm =
  | { kind: "ok"; title: string; description: string; canonicalPath: string }
  | { kind: "not_found" }
  | { kind: "unavailable" };

export async function composeArtistMetadata(
  catalogue: ArtCataloguePort,
  slug: string,
): Promise<ArtistMetadataVm> {
  let artist: PublicArtistDetail | null;
  try {
    artist = await catalogue.getArtist(slug);
  } catch {
    return { kind: "unavailable" };
  }
  if (!artist) return { kind: "not_found" };
  const description =
    seoMetadataDescription(artist, artist.shortBio ?? artist.bio) ??
    `Discover works by ${artist.name} at LAX Art.`;
  return {
    kind: "ok",
    title: seoMetadataTitle(artist, artist.name),
    description,
    canonicalPath: artistHref(artist.slug),
  };
}
