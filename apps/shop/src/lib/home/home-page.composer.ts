import { HOME_ARTISTS_MAX, chooseHomeArtists } from "@/lib/home/home-artists";
import {
  HOME_HERO_PRICE_RANGES,
  HOME_PRICE_BANDS_POUNDS,
  type HomePriceRangeCount,
  MAX_COLLECTIONS,
  type PriceBandCount,
  chooseCollectionCategories,
} from "@/lib/home/home-browse-paths";
import type { HomeCatalogueReader } from "@/lib/home/home-catalogue.port";
import type {
  PublicArtistDetail,
  PublicArtistSummary,
  PublicArtworkFacetCounts,
  PublicArtworkSummary,
} from "@auction/shop-contracts";
import { HOME_RELEASE_CANDIDATE_LIMIT } from "@auction/shop-domain";

export type HomeSectionKey = "editions" | "artists";

/** The release in the first screen and a row of four below it. */
export const HOME_NEW_EDITIONS_LIMIT = 5;
/** The placed prints the release is chosen from; LAX Admin reads the same limit. */
const FEATURED_LIMIT = HOME_RELEASE_CANDIDATE_LIMIT;
const COVERS_PER_COLLECTION = 2;
/** Enough newest artists to fill the section after the featured ones are taken out. */
const NEWEST_ARTISTS_LIMIT = HOME_ARTISTS_MAX * 2;

export type HomePageComposerResult = {
  /** Editions staff place in the home page's release slot, in their order. */
  featured: PublicArtworkSummary[];
  /** Newest editions that can be bought now. */
  editions: PublicArtworkSummary[];
  /** Null when the editions read failed, so an outage is not shown as an empty Shop. */
  availableCount: number | null;
  /** The lowest price of an edition on sale now, in pence. */
  lowestPricePence: number | null;
  facets: PublicArtworkFacetCounts | null;
  priceBands: PriceBandCount[];
  /** Editions on sale in each of the first screen's price ranges. */
  priceRanges: HomePriceRangeCount[];
  /** A couple of works for each category tile, by category slug. */
  categoryCovers: Record<string, PublicArtworkSummary[]>;
  /** Artists with an edition on sale: staff-featured first, then by newest edition. */
  artists: PublicArtistSummary[];
  /** Every artist with an edition on sale, when the catalogue said. */
  artistCount: number | null;
  /** The profile of the one artist, when the section features a single artist. */
  soloArtist: PublicArtistDetail | null;
  sectionErrors: Partial<Record<HomeSectionKey, string>>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Section unavailable";
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

async function readPriceBands(reader: HomeCatalogueReader): Promise<PriceBandCount[]> {
  const results = await Promise.allSettled(
    HOME_PRICE_BANDS_POUNDS.map(async (maxPounds) => {
      const list = await reader.listEditions({
        limit: COVERS_PER_COLLECTION,
        availability: "available",
        maxPrice: maxPounds * 100,
      });
      return { maxPounds, count: list.totalCount ?? list.items.length, covers: list.items };
    }),
  );
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

async function readPriceRanges(reader: HomeCatalogueReader): Promise<HomePriceRangeCount[]> {
  const results = await Promise.allSettled(
    HOME_HERO_PRICE_RANGES.map(async (range) => {
      const list = await reader.listEditions({
        limit: 1,
        availability: "available",
        ...(range.minPounds !== undefined ? { minPrice: range.minPounds * 100 } : {}),
        ...(range.maxPounds !== undefined ? { maxPrice: range.maxPounds * 100 } : {}),
      });
      return { key: range.key, count: list.totalCount ?? list.items.length };
    }),
  );
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

async function readCategoryCovers(
  reader: HomeCatalogueReader,
  facets: PublicArtworkFacetCounts | null,
): Promise<Record<string, PublicArtworkSummary[]>> {
  const categories = chooseCollectionCategories(facets, MAX_COLLECTIONS);
  const results = await Promise.allSettled(
    categories.map(async (category) => {
      const list = await reader.listEditions({
        limit: COVERS_PER_COLLECTION,
        categorySlug: category.slug,
      });
      return [category.slug, list.items] as const;
    }),
  );
  return Object.fromEntries(
    results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
  );
}

async function readSoloArtist(
  reader: HomeCatalogueReader,
  artists: readonly PublicArtistSummary[],
): Promise<PublicArtistDetail | null> {
  const only = artists.length === 1 ? artists[0] : undefined;
  if (!only) return null;
  try {
    return await reader.getArtist(only.slug);
  } catch {
    // The feature still shows the name, discipline and count without the profile.
    return null;
  }
}

/**
 * Every read the home page needs, in parallel. A failed read leaves its section out rather than
 * failing the page; only the new editions report an error, because they are the page's point.
 */
export async function composeHomePageData(
  reader: HomeCatalogueReader,
): Promise<HomePageComposerResult> {
  const [featured, editions, cheapest, facets, featuredArtists, newestArtists, priceBands, ranges] =
    await Promise.allSettled([
      reader.listEditions({ limit: FEATURED_LIMIT, placement: "featured_prints" }),
      reader.listEditions({ limit: HOME_NEW_EDITIONS_LIMIT, availability: "available" }),
      reader.listEditions({ limit: 1, availability: "available", sort: "priceAsc" }),
      reader.countFacets(),
      reader.listArtists({
        limit: HOME_ARTISTS_MAX,
        placement: "featured_artists",
        hasAvailableEditions: true,
      }),
      reader.listArtists({
        limit: NEWEST_ARTISTS_LIMIT,
        hasAvailableEditions: true,
        sort: "latestEdition",
      }),
      readPriceBands(reader),
      readPriceRanges(reader),
    ]);

  const facetCounts = settledValue(facets);
  const newest = settledValue(newestArtists);
  const artists = chooseHomeArtists(
    settledValue(featuredArtists)?.items ?? [],
    newest?.items ?? [],
  );
  const [categoryCovers, soloArtist] = await Promise.all([
    readCategoryCovers(reader, facetCounts),
    readSoloArtist(reader, artists),
  ]);

  const sectionErrors: Partial<Record<HomeSectionKey, string>> = {};
  const editionList = settledValue(editions);
  if (editions.status === "rejected") sectionErrors.editions = errorMessage(editions.reason);
  if (artists.length === 0 && newestArtists.status === "rejected") {
    sectionErrors.artists = errorMessage(newestArtists.reason);
  }

  return {
    featured: settledValue(featured)?.items ?? [],
    editions: editionList?.items ?? [],
    availableCount: editionList ? (editionList.totalCount ?? editionList.items.length) : null,
    lowestPricePence: settledValue(cheapest)?.items[0]?.printPricePence ?? null,
    facets: facetCounts,
    priceBands: settledValue(priceBands) ?? [],
    priceRanges: settledValue(ranges) ?? [],
    categoryCovers,
    artists,
    artistCount: newest ? (newest.total ?? (newest.nextCursor ? null : newest.items.length)) : null,
    soloArtist,
    sectionErrors,
  };
}
