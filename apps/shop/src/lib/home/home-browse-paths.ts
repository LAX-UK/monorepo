import { artworkCatalogueHref } from "@/lib/catalogue/artwork-catalogue-params";
import type { PublicArtworkFacetCounts, PublicArtworkSummary } from "@auction/shop-contracts";

/*
 * The ways into the catalogue the home page offers: quick filters under the hero and the
 * "Start a collection" tiles. Every path is built from real counts, and a path that would lead to
 * too few works is left out, so the home page never sends anyone to a thin or empty page.
 */

/** Gift price ceilings, in pounds, tried from the lowest. */
export const HOME_PRICE_BANDS_POUNDS = [150, 300, 500] as const;
/** A collection needs this many works to be worth a tile. */
export const MIN_COLLECTION_SIZE = 3;
export const MAX_COLLECTIONS = 3;
/** Fewer quick filters than this read as an afterthought, so the row is left out. */
export const MIN_QUICK_FILTERS = 2;
export const MAX_QUICK_FILTERS = 6;

/** Editions on sale at or under a price, with a couple of them to show on the tile. */
export type PriceBandCount = {
  maxPounds: number;
  count: number;
  covers: readonly PublicArtworkSummary[];
};

export type HomeQuickFilterVm = { key: string; label: string; count: number; href: string };

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

function priceBandLabel(band: PriceBandCount): string {
  return `Up to £${band.maxPounds}`;
}

/**
 * "Start a collection": the price band first (gift buyers start there), then the largest
 * categories, three at most. Fewer than two tiles is not a choice, so none are shown.
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
  return tiles.length >= 2 ? tiles : [];
}

/**
 * Quick filters under the hero, each with its count: on sale now (only when some editions are
 * sold out, otherwise it is the whole catalogue), the price band, then categories.
 */
export function buildHomeQuickFilters(input: {
  facets: PublicArtworkFacetCounts | null;
  priceBand: PriceBandCount | null;
}): HomeQuickFilterVm[] {
  const { facets, priceBand } = input;
  const filters: HomeQuickFilterVm[] = [];
  if (facets && facets.availability.available > 0 && facets.availability.soldOut > 0) {
    filters.push({
      key: "available",
      label: "Available now",
      count: facets.availability.available,
      href: artworkCatalogueHref({ sort: "newest", availability: "available" }),
    });
  }
  if (priceBand) {
    filters.push({
      key: `price-${priceBand.maxPounds}`,
      label: priceBandLabel(priceBand),
      count: priceBand.count,
      href: priceBandHref(priceBand),
    });
  }
  for (const category of facets?.categories ?? []) {
    if (filters.length >= MAX_QUICK_FILTERS) break;
    if (category.count < 1) continue;
    filters.push({
      key: `category-${category.slug}`,
      label: category.label,
      count: category.count,
      href: categoryHref(category.slug),
    });
  }
  return filters.length >= MIN_QUICK_FILTERS ? filters : [];
}
