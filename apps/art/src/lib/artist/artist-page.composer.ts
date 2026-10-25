import type { ArtViewerState } from "@/lib/art-viewer-state";
import { shopBaseUrl } from "@/lib/artwork/shop-editions.vm";
import {
  type CatalogueArtworkCardVm,
  artistHref,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import { type EditorialCardVm, exhibitionCard, storyCard } from "@/lib/editorial/editorial-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type {
  ArtCataloguePort,
  ArtEcosystemPort,
  ArtEditorialPort,
  ArtFavoritesReadPort,
  ArtViewerPort,
} from "@/lib/ports";
import { artistJsonLd } from "@/lib/seo/art-structured-data";
import { seoMetadataDescription, seoMetadataTitle } from "@/lib/seo/seo-metadata";
import type { JsonLd } from "@auction/branding";
import type { MarketingArtistCrossLink, MarketingArtistFactInput } from "@auction/marketing-ui";
import type { PublicArtistDetail } from "@auction/shop-contracts";
import {
  type ArtistSectionTab,
  artistSectionTabs,
  formatArtistLifeLine,
} from "./artist-profile.vm";

export type ArtistPageVm = {
  slug: string;
  name: string;
  discipline: string | null;
  /** Nationality, life span and discipline for the hero facts line. */
  facts: MarketingArtistFactInput;
  bio: string | null;
  portraitUrl: string | null;
  portraitAlt: string;
  /** Full-bleed hero image; null falls back to the plain title band. */
  heroUrl: string | null;
  /** "French, 1869–1954"; null when nothing is known. */
  lifeLine: string | null;
  works: CatalogueArtworkCardVm[];
  worksFailed: boolean;
  /** Works sold as originals; empty hides the band. */
  originals: CatalogueArtworkCardVm[];
  exhibitions: EditorialCardVm[];
  /** Stories, films and press that feature the artist. */
  stories: EditorialCardVm[];
  /** "Editions in LAX Shop" when the Shop has editions by this artist (one shared artist list). */
  crossLinks: MarketingArtistCrossLink[];
  sectionTabs: ArtistSectionTab[];
  viewer: ArtViewerState;
  following: boolean;
  favoriteAuth: ArtFavoriteAuth;
  structuredData: JsonLd[];
};

export type ArtistPageResult =
  | { kind: "ok"; vm: ArtistPageVm }
  | { kind: "not_found" }
  | { kind: "unavailable" };

const FEATURED_WORKS_LIMIT = 8;
const ORIGINALS_LIMIT = 4;

/**
 * "Editions in LAX Shop" when the Shop has live editions by the artist. LAX Shop and lax.art
 * read the same artist list, so the slug is the same artist in both.
 */
async function loadShopEditionsLink(
  services: { catalogue: ArtCataloguePort; ecosystem: ArtEcosystemPort },
  slug: string,
): Promise<MarketingArtistCrossLink[]> {
  const shop = shopBaseUrl(services.ecosystem.crossProductLinks());
  if (!shop) return [];
  const editions = await services.catalogue
    .listShopEditionsByArtist(slug, 1)
    .catch(() => ({ items: [] }));
  if (editions.items.length === 0) return [];
  return [
    {
      id: "shop",
      label: "Editions in LAX Shop",
      description: "Limited editions and prints",
      href: new URL(`/artists/${encodeURIComponent(slug)}`, shop).toString(),
    },
  ];
}

export async function composeArtistPage(
  services: {
    catalogue: ArtCataloguePort;
    viewer: ArtViewerPort;
    favorites: ArtFavoritesReadPort;
    editorial: ArtEditorialPort;
    ecosystem: ArtEcosystemPort;
  },
  slug: string,
  siteUrl: URL,
): Promise<ArtistPageResult> {
  const favoritesPromise = loadViewerFavoriteContext(services, artistHref(slug), {
    savedArtworks: true,
    followedArtists: true,
  });
  const [artist, works, originals, relations] = await Promise.allSettled([
    services.catalogue.getArtist(slug),
    services.catalogue.listArtworks({ artistSlugs: [slug], limit: FEATURED_WORKS_LIMIT }),
    services.catalogue.listArtworks({
      artistSlugs: [slug],
      type: "original",
      limit: ORIGINALS_LIMIT,
    }),
    services.editorial.getArtistRelations(slug),
  ]);
  const favorites = await favoritesPromise;
  if (artist.status === "rejected") return { kind: "unavailable" };
  const detail: PublicArtistDetail | null = artist.value;
  if (!detail) return { kind: "not_found" };

  const workCards =
    works.status === "fulfilled"
      ? buildCatalogueArtworkCards(works.value.items, favorites.savedArtworkSlugs)
      : [];
  const originalCards =
    originals.status === "fulfilled"
      ? buildCatalogueArtworkCards(originals.value.items, favorites.savedArtworkSlugs)
      : [];
  // A failed or disabled editorial read hides only the exhibition and story sections.
  const related =
    relations.status === "fulfilled" && relations.value.status === "ok"
      ? relations.value.data
      : null;
  const exhibitions = related?.exhibitions.map(exhibitionCard) ?? [];
  const stories = related?.stories.map(storyCard) ?? [];
  const crossLinks = await loadShopEditionsLink(services, detail.slug);

  return {
    kind: "ok",
    vm: {
      slug: detail.slug,
      name: detail.name,
      discipline: detail.discipline,
      facts: {
        nationality: detail.nationality ?? null,
        birthYear: detail.birthYear ?? null,
        deathYear: detail.deathYear ?? null,
        discipline: detail.discipline,
      },
      bio: detail.bio,
      portraitUrl: detail.portraitUrl,
      portraitAlt: `Portrait of ${detail.name}`,
      heroUrl: detail.heroUrl ?? null,
      lifeLine: formatArtistLifeLine(detail),
      works: workCards,
      worksFailed: works.status === "rejected",
      originals: originalCards,
      exhibitions,
      stories,
      crossLinks,
      sectionTabs: artistSectionTabs({
        works: true,
        originals: originalCards.length > 0,
        exhibitions: exhibitions.length > 0,
        stories: stories.length > 0,
      }),
      viewer: favorites.viewer,
      following: favorites.followedArtistSlugs.has(detail.slug),
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
    `Discover works by ${artist.name} at lax.art.`;
  return {
    kind: "ok",
    title: seoMetadataTitle(artist, artist.name),
    description,
    canonicalPath: artistHref(artist.slug),
  };
}
