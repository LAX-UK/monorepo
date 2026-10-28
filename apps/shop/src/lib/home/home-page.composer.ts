import {
  HOME_PRICE_BANDS_POUNDS,
  MAX_COLLECTIONS,
  type PriceBandCount,
  chooseCollectionCategories,
} from "@/lib/home/home-browse-paths";
import type { HomeCatalogueReader } from "@/lib/home/home-catalogue.port";
import type {
  PublicArtistSummary,
  PublicArtworkFacetCounts,
  PublicArtworkSummary,
} from "@auction/shop-contracts";

export type HomeSectionKey = "editions" | "artists";

/** Enough to count every artist in one read; past this the hero does not give a number. */
export const HOME_ARTIST_COUNT_LIMIT = 50;
/** The release in the first screen and a row of four below it. */
export const HOME_NEW_EDITIONS_LIMIT = 5;
const FEATURED_LIMIT = 4;
const COVERS_PER_COLLECTION = 2;

/** A story told about one edition. Shop has no editorial source yet, so it is always empty. */
export type HomeStory = {
  title: string;
  body: string;
  imageUrl: string;
  edition: { title: string; href: string } | null;
  readMoreHref: string | null;
};

export type HomePageComposerResult = {
  /** Editions staff place in the home page's release slot, in their order. */
  featured: PublicArtworkSummary[];
  /** Newest editions that can be bought now. */
  editions: PublicArtworkSummary[];
  /** How many editions can be bought now, when the catalogue said. */
  availableCount: number | null;
  /** The lowest price of an edition on sale now, in pence. */
  lowestPricePence: number | null;
  facets: PublicArtworkFacetCounts | null;
  priceBands: PriceBandCount[];
  /** A couple of works for each category tile, by category slug. */
  categoryCovers: Record<string, PublicArtworkSummary[]>;
  /** Artists staff feature on the home page, or the newest artists when none are featured. */
  artists: PublicArtistSummary[];
  /** How many artists have Shop editions, or null when there are more than one read returns. */
  artistCount: number | null;
  story: HomeStory | null;
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

/**
 * Every read the home page needs, in parallel. A failed read leaves its section out rather than
 * failing the page; only the new editions report an error, because they are the page's point.
 */
export async function composeHomePageData(
  reader: HomeCatalogueReader,
): Promise<HomePageComposerResult> {
  const [featured, editions, cheapest, facets, featuredArtists, allArtists, priceBands] =
    await Promise.allSettled([
      reader.listEditions({ limit: FEATURED_LIMIT, placement: "featured_prints" }),
      reader.listEditions({ limit: HOME_NEW_EDITIONS_LIMIT, availability: "available" }),
      reader.listEditions({ limit: 1, availability: "available", sort: "priceAsc" }),
      reader.countFacets(),
      reader.listArtists({ limit: 4, placement: "featured_artists" }),
      reader.listArtists({ limit: HOME_ARTIST_COUNT_LIMIT }),
      readPriceBands(reader),
    ]);

  const facetCounts = settledValue(facets);
  const categoryCovers = await readCategoryCovers(reader, facetCounts);

  const sectionErrors: Partial<Record<HomeSectionKey, string>> = {};
  const editionList = settledValue(editions);
  if (editions.status === "rejected") sectionErrors.editions = errorMessage(editions.reason);

  const everyArtist = settledValue(allArtists);
  const featuredItems = settledValue(featuredArtists)?.items ?? [];
  const artists = featuredItems.length > 0 ? featuredItems : (everyArtist?.items.slice(0, 4) ?? []);
  if (artists.length === 0 && allArtists.status === "rejected") {
    sectionErrors.artists = errorMessage(allArtists.reason);
  }

  return {
    featured: settledValue(featured)?.items ?? [],
    editions: editionList?.items ?? [],
    availableCount: editionList?.totalCount ?? null,
    lowestPricePence: settledValue(cheapest)?.items[0]?.printPricePence ?? null,
    facets: facetCounts,
    priceBands: settledValue(priceBands) ?? [],
    categoryCovers,
    artists,
    artistCount: everyArtist && !everyArtist.nextCursor ? everyArtist.items.length : null,
    story: null,
    sectionErrors,
  };
}
