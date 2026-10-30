import type { ArtViewerState } from "@/lib/art-viewer-state";
import { shopBaseUrl } from "@/lib/artwork/shop-editions.vm";
import {
  type CatalogueArtworkCardVm,
  artistHref,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtEditorialStorySummary } from "@/lib/editorial/art-editorial.types";
import { type ArtHubPressRowVm, buildHubPressRows } from "@/lib/editorial/art-hub.vm";
import { type EditorialCardVm, exhibitionCard, storyCard } from "@/lib/editorial/editorial-card.vm";
import { newestFirst } from "@/lib/editorial/editorial-story.vm";
import { bidSellUrl } from "@/lib/editorial/how-to-sell.vm";
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
import {
  type MarketingArtistCrossLink,
  type MarketingArtistFactInput,
  type MarketingSectionSurface,
  resolveBandSequence,
} from "@auction/marketing-ui";
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
  /** Originals still available (for sale or price on request). */
  works: CatalogueArtworkCardVm[];
  /** Sold originals, shown as the artist's record with the gallery. */
  soldWorks: CatalogueArtworkCardVm[];
  worksFailed: boolean;
  /** Available works render (works, an empty state or an error) unless sold works stand in. */
  showWorks: boolean;
  exhibitions: EditorialCardVm[];
  /** Films first, then stories that feature the artist. */
  stories: EditorialCardVm[];
  /** Press coverage that features the artist. */
  press: ArtHubPressRowVm[];
  /** "Editions by {artist} in LAX Shop" when the Shop has editions by them (one artist list). */
  crossLinks: MarketingArtistCrossLink[];
  /** LAX Bid's "Sell with LAX" for collectors who own a work; lax.art takes no consignments. */
  sellHref: string | null;
  sectionTabs: ArtistSectionTab[];
  /** Sold works sit on a cream band unless the gallery team band would then touch it. */
  soldSurface: MarketingSectionSurface;
  viewer: ArtViewerState;
  following: boolean;
  favoriteAuth: ArtFavoriteAuth;
  structuredData: JsonLd[];
};

export type ArtistPageResult =
  | { kind: "ok"; vm: ArtistPageVm }
  | { kind: "not_found" }
  | { kind: "unavailable" };

const AVAILABLE_WORKS_LIMIT = 8;
const SOLD_WORKS_LIMIT = 4;
const PRESS_LIMIT = 5;

/**
 * "Editions by {artist} in LAX Shop" when the Shop has live editions by the artist. LAX Shop and
 * lax.art read the same artist list, so the slug is the same artist in both.
 */
async function loadShopEditionsLink(
  services: { catalogue: ArtCataloguePort; ecosystem: ArtEcosystemPort },
  artist: { slug: string; name: string },
): Promise<MarketingArtistCrossLink[]> {
  const { slug } = artist;
  const shop = shopBaseUrl(services.ecosystem.crossProductLinks());
  if (!shop) return [];
  const editions = await services.catalogue
    .listShopEditionsByArtist(slug, 1)
    .catch(() => ({ items: [] }));
  if (editions.items.length === 0) return [];
  return [
    {
      id: "shop",
      label: `Editions by ${artist.name} in LAX Shop`,
      description: "Limited editions and prints",
      href: new URL(`/artists/${encodeURIComponent(slug)}`, shop).toString(),
    },
  ];
}

/** Films lead the artist's stories (Figma `454:6937`); press is listed on its own. */
function splitStories(stories: readonly ArtEditorialStorySummary[]): {
  stories: EditorialCardVm[];
  press: ArtHubPressRowVm[];
} {
  const sorted = newestFirst(stories);
  const features = sorted.filter((story) => story.kind !== "press");
  const films = features.filter((story) => story.kind === "film");
  const others = features.filter((story) => story.kind !== "film");
  return {
    stories: [...films, ...others].map(storyCard),
    press: buildHubPressRows(
      sorted.filter((story) => story.kind === "press").slice(0, PRESS_LIMIT),
    ),
  };
}

/**
 * The page's band rhythm: the sold record is a cream band, the gallery team band closes the
 * page. Everything between them is plain, so the sold band gives way only when nothing else
 * separates the two.
 */
function soldSurface(sectionsAfterSold: number): MarketingSectionSurface {
  const surfaces = resolveBandSequence([
    { id: "sold", surface: "band", flexible: true },
    ...(sectionsAfterSold > 0
      ? [{ id: "between", surface: "plain", flexible: false } as const]
      : []),
    { id: "team", surface: "band", flexible: false },
  ]);
  return surfaces.sold;
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
  // lax.art lists originals only: available works first, then sold works as the artist's record.
  const [artist, works, sold, relations] = await Promise.allSettled([
    services.catalogue.getArtist(slug),
    services.catalogue.listArtworks({
      artistSlugs: [slug],
      saleState: "available",
      limit: AVAILABLE_WORKS_LIMIT,
    }),
    services.catalogue.listArtworks({
      artistSlugs: [slug],
      saleState: "sold",
      limit: SOLD_WORKS_LIMIT,
    }),
    services.editorial.getArtistRelations(slug),
  ]);
  const favorites = await favoritesPromise;
  if (artist.status === "rejected") return { kind: "unavailable" };
  const detail: PublicArtistDetail | null = artist.value;
  if (!detail) return { kind: "not_found" };

  const cards = (result: typeof works) =>
    result.status === "fulfilled"
      ? buildCatalogueArtworkCards(result.value.items, favorites.savedArtworkSlugs)
      : [];
  const workCards = cards(works);
  const soldCards = cards(sold);
  // A failed or disabled editorial read hides only the exhibition, story and press sections.
  const related =
    relations.status === "fulfilled" && relations.value.status === "ok"
      ? relations.value.data
      : null;
  const exhibitions = related?.exhibitions.map(exhibitionCard) ?? [];
  const { stories, press } = splitStories(related?.stories ?? []);
  const crossLinks = await loadShopEditionsLink(services, detail);
  const sellHref = bidSellUrl(services.ecosystem.crossProductLinks());
  const worksFailed = works.status === "rejected";

  const showWorks = workCards.length > 0 || worksFailed || soldCards.length === 0;

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
      bio: detail.bio?.trim() || null,
      portraitUrl: detail.portraitUrl,
      portraitAlt: `Portrait of ${detail.name}`,
      heroUrl: detail.heroUrl ?? null,
      lifeLine: formatArtistLifeLine(detail),
      works: workCards,
      soldWorks: soldCards,
      worksFailed,
      showWorks,
      exhibitions,
      stories,
      press,
      crossLinks,
      sellHref,
      sectionTabs: artistSectionTabs({
        works: showWorks,
        sold: soldCards.length > 0,
        exhibitions: exhibitions.length > 0,
        stories: stories.length > 0,
        press: press.length > 0,
      }),
      soldSurface: soldSurface(
        [exhibitions.length, stories.length, press.length, sellHref ? 1 : 0].filter((n) => n > 0)
          .length,
      ),
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
