import { artworkCatalogueHref } from "@/lib/catalogue/artwork-catalogue-params";
import type { PublicArtworkFacetCounts, PublicArtworkSummary } from "@auction/shop-contracts";

/*
 * The ways into the catalogue the home page offers: the "Browse by" rows in the first screen and
 * the "Start a collection" tiles. Every path is built from real counts, and a path that would lead
 * to too few works is left out, so the home page never sends anyone to a thin or empty page.
 */

/** Gift price ceilings, in pounds, tried from the lowest. */
export const HOME_PRICE_BANDS_POUNDS = [150, 300, 500] as const;
/** A collection needs this many works to be worth a tile. */
export const MIN_COLLECTION_SIZE = 3;
/** A pair at two tiles, one row at three or four. */
export const MAX_COLLECTIONS = 4;
/** Fewer tiles than this is not a choice; the first screen's "Browse by" rows cover it. */
export const MIN_COLLECTIONS = 2;

/** Editions on sale at or under a price, with a couple of them to show on the tile. */
export type PriceBandCount = {
  maxPounds: number;
  count: number;
  covers: readonly PublicArtworkSummary[];
};

export type HomeCollectionVm = {
  key: string;
  title: string;
  /** "9 editions". */
  countLabel: string;
  href: string;
  /** Up to two works shown on the tile. */
  covers: readonly PublicArtworkSummary[];
};

export function editionCountLabel(count: number): string {
  return count === 1 ? "1 edition" : `${count} editions`;
}

/**
 * The lowest price band that is a real narrowing: enough works to browse, but not every edition
 * on sale (a band that holds everything says nothing).
 */
export function choosePriceBand(
  bands: readonly PriceBandCount[],
  availableCount: number | null,
): PriceBandCount | null {
  const sorted = [...bands].sort((a, b) => a.maxPounds - b.maxPounds);
  return (
    sorted.find(
      (band) =>
        band.count >= MIN_COLLECTION_SIZE &&
        (availableCount === null || band.count < availableCount),
    ) ?? null
  );
}

/** Categories big enough to be a collection, largest first. */
export function chooseCollectionCategories(
  facets: PublicArtworkFacetCounts | null,
  limit: number,
): PublicArtworkFacetCounts["categories"] {
  if (!facets || limit <= 0) return [];
  return facets.categories
    .filter((category) => category.count >= MIN_COLLECTION_SIZE)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function priceBandHref(band: PriceBandCount): string {
  return artworkCatalogueHref({
    sort: "newest",
    availability: "available",
    maxPrice: band.maxPounds,
  });
}

function categoryHref(slug: string): string {
  return artworkCatalogueHref({ sort: "newest", categorySlug: slug });
}

/**
 * "Start a collection": the price band first (gift buyers start there), then the largest
 * categories, four at most. Fewer than two tiles is not a choice, so none are shown.
 */
export function buildHomeCollections(input: {
  priceBand: PriceBandCount | null;
  categories: PublicArtworkFacetCounts["categories"];
  categoryCovers: Readonly<Record<string, readonly PublicArtworkSummary[]>>;
}): HomeCollectionVm[] {
  const tiles: HomeCollectionVm[] = [];
  if (input.priceBand) {
    tiles.push({
      key: `price-${input.priceBand.maxPounds}`,
      title: `Editions up to £${input.priceBand.maxPounds}`,
      countLabel: editionCountLabel(input.priceBand.count),
      href: priceBandHref(input.priceBand),
      covers: input.priceBand.covers.slice(0, 2),
    });
  }
  for (const category of input.categories) {
    if (tiles.length >= MAX_COLLECTIONS) break;
    tiles.push({
      key: `category-${category.slug}`,
      title: category.label,
      countLabel: editionCountLabel(category.count),
      href: categoryHref(category.slug),
      covers: (input.categoryCovers[category.slug] ?? []).slice(0, 2),
    });
  }
  return tiles.length >= MIN_COLLECTIONS ? tiles : [];
}

/** A price range the first screen offers, in whole pounds as the catalogue's filter takes them. */
export type HomePriceRange = {
  key: string;
  label: string;
  minPounds?: number;
  maxPounds?: number;
};

/** "Under £100" and "£100 to £300", the two ranges a first-time buyer starts from. */
export const HOME_HERO_PRICE_RANGES: readonly HomePriceRange[] = [
  { key: "under-100", label: "Under £100", maxPounds: 99 },
  { key: "100-300", label: "£100 to £300", minPounds: 100, maxPounds: 300 },
];

/** How many editions on sale fall in a range. */
export type HomePriceRangeCount = { key: string; count: number };

/** One "Browse by" row under the first screen's actions. */
export type HomeBrowseRowVm = { key: string; label: string; count: number; href: string };

/**
 * "Browse by" in the first screen: available now, the two price ranges, and the artist with the
 * most editions. Each row carries its count; a row that would lead to nothing is left out.
 */
export function buildHomeBrowseRows(input: {
  facets: PublicArtworkFacetCounts | null;
  priceRanges: readonly HomePriceRangeCount[];
}): HomeBrowseRowVm[] {
  const rows: HomeBrowseRowVm[] = [
    {
      key: "available",
      label: "Available now",
      count: input.facets?.availability.available ?? 0,
      href: artworkCatalogueHref({ sort: "newest", availability: "available" }),
    },
  ];
  for (const range of HOME_HERO_PRICE_RANGES) {
    rows.push({
      key: `price-${range.key}`,
      label: range.label,
      count: input.priceRanges.find((counted) => counted.key === range.key)?.count ?? 0,
      href: artworkCatalogueHref({
        sort: "newest",
        availability: "available",
        ...(range.minPounds !== undefined ? { minPrice: range.minPounds } : {}),
        ...(range.maxPounds !== undefined ? { maxPrice: range.maxPounds } : {}),
      }),
    });
  }
  const topArtist = [...(input.facets?.artists ?? [])].sort((a, b) => b.count - a.count)[0];
  if (topArtist) {
    rows.push({
      key: `artist-${topArtist.slug}`,
      label: topArtist.name,
      count: topArtist.count,
      href: `/artists/${encodeURIComponent(topArtist.slug)}`,
    });
  }
  return rows.filter((row) => row.count > 0);
}
