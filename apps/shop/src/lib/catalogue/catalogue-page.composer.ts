import {
  type ArtworkCatalogueFilterPatch,
  type ArtworkCatalogueUrlState,
  CATALOGUE_MAX_SHOWN,
  CATALOGUE_PAGE_SIZE,
  type CatalogActiveFilterChip,
  artworkCatalogueClearHref,
  artworkCatalogueFetchQuery,
  artworkCatalogueFilterHref,
  artworkCatalogueHasActiveFilters,
  artworkCatalogueHref,
  artworkCatalogueLoadMoreHref,
} from "@/lib/catalogue/artwork-catalogue-params";
import { buildArtworkCatalogueActiveChips } from "@/lib/catalogue/catalogue-active-chips";
import { catalogueCountLine, editionsLabel } from "@/lib/catalogue/catalogue-count-line";
import { suggestCatalogueTerm } from "@/lib/catalogue/catalogue-did-you-mean";
import {
  type CatalogueFilterRailVm,
  buildCatalogueFilterRail,
} from "@/lib/catalogue/catalogue-filter-groups";
import type { CatalogueFacetQuery, CatalogueReader } from "@/lib/catalogue/catalogue-page.port";
import {
  type CatalogueQuickChipVm,
  buildCatalogueQuickChips,
} from "@/lib/catalogue/catalogue-quick-chips";
import { loadCatalogueResults } from "@/lib/catalogue/catalogue-results";
import type {
  PublicArtistSummary,
  PublicArtworkFacetCounts,
  PublicArtworkSummary,
} from "@auction/shop-contracts";

/** "Available now" under a state with no results: one row beside the rail. */
export const CATALOGUE_SUGGESTION_LIMIT = 3;
/** Artists matching a search with no editions. */
export const CATALOGUE_SEARCH_ARTIST_LIMIT = 4;

export type CatalogueSuggestionsVm = {
  items: PublicArtworkSummary[];
  /** "View all 3", to every edition on sale now. */
  viewAll: { href: string; label: string } | null;
};

export type CatalogueResultsVm = {
  items: PublicArtworkSummary[];
  total: number;
  /** Null once every edition is on the page. */
  loadMoreHref: string | null;
};

/** Filters that give nothing: take the last one off, or clear them all. */
export type CatalogueNoMatchVm = {
  remove: { label: string; href: string } | null;
  clearHref: string;
  availableNow: CatalogueSuggestionsVm | null;
};

export type CataloguePageVm =
  /** The editions could not be read. */
  | { kind: "unavailable" }
  /** Nothing on sale in the whole catalogue: there is nothing to filter. */
  | { kind: "empty"; countLine: string }
  /** A search with no editions: what it might have meant, and where to go instead. */
  | {
      kind: "search-empty";
      query: string;
      didYouMean: { term: string; href: string } | null;
      artists: PublicArtistSummary[];
      availableNow: CatalogueSuggestionsVm | null;
    }
  | {
      kind: "catalogue";
      countLine: string;
      /** Announced as the filters change, e.g. "3 editions". */
      liveMessage: string;
      rail: CatalogueFilterRailVm;
      quickChips: CatalogueQuickChipVm[];
      activeChips: CatalogActiveFilterChip[];
      activeCount: number;
      results: CatalogueResultsVm;
      noMatch: CatalogueNoMatchVm | null;
    };

function facetQuery(state: ArtworkCatalogueUrlState): CatalogueFacetQuery {
  const { sort: _sort, ...query } = artworkCatalogueFetchQuery(state);
  return query;
}

async function settled<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function catalogueTotal(facets: PublicArtworkFacetCounts | null): number | null {
  return facets ? facets.availability.available + facets.availability.soldOut : null;
}

async function readAvailableNow(
  reader: CatalogueReader,
  facets: PublicArtworkFacetCounts | null,
): Promise<CatalogueSuggestionsVm | null> {
  const list = await settled(
    reader.listEditions({ availability: "available", limit: CATALOGUE_SUGGESTION_LIMIT }),
  );
  if (!list || list.items.length === 0) return null;
  const total = facets?.availability.available ?? list.totalCount ?? list.items.length;
  return {
    items: list.items,
    viewAll:
      total > list.items.length
        ? {
            href: artworkCatalogueHref({ sort: "newest", availability: "available" }),
            label: `View all ${total}`,
          }
        : null,
  };
}

type SearchSuggestion = { term: string; patch: ArtworkCatalogueFilterPatch };

/**
 * What a search might have meant, each with the filter that finds it: an artist's name searches
 * for the artist; a technique or category applies that filter in place of the search.
 */
function searchSuggestions(
  facets: PublicArtworkFacetCounts | null,
  categories: ReadonlyArray<{ slug: string; label: string }>,
): SearchSuggestion[] {
  return [
    ...(facets?.artists.map((artist) => ({ term: artist.name, patch: { q: artist.name } })) ?? []),
    ...(facets?.techniques?.map((technique) => ({
      term: technique.value,
      patch: { q: null, technique: technique.value },
    })) ?? []),
    ...categories.map((category) => ({
      term: category.label,
      patch: { q: null, categorySlug: category.slug },
    })),
  ];
}

async function composeSearchEmpty(
  reader: CatalogueReader,
  state: ArtworkCatalogueUrlState & { q: string },
  wholeCatalogue: PublicArtworkFacetCounts | null,
  categories: ReadonlyArray<{ slug: string; label: string }>,
): Promise<CataloguePageVm> {
  const [artists, availableNow] = await Promise.all([
    settled(reader.searchArtists(state.q, CATALOGUE_SEARCH_ARTIST_LIMIT)),
    readAvailableNow(reader, wholeCatalogue),
  ]);
  const suggestion = suggestCatalogueTerm(state.q, searchSuggestions(wholeCatalogue, categories));
  return {
    kind: "search-empty",
    query: state.q,
    didYouMean: suggestion
      ? { term: suggestion.term, href: artworkCatalogueFilterHref(state, suggestion.patch) }
      : null,
    artists: artists?.items ?? [],
    availableNow,
  };
}

/**
 * Everything the catalogue page shows for the URL's filters. Counts and suggestions are a help,
 * not a requirement: when they fail the list still shows. Only a failed list is an error.
 */
export async function composeCataloguePage(
  reader: CatalogueReader,
  state: ArtworkCatalogueUrlState,
): Promise<CataloguePageVm> {
  const filtered = artworkCatalogueHasActiveFilters(state);
  const shown = state.shown ?? CATALOGUE_PAGE_SIZE;
  const [results, facets, unfilteredFacets, categories] = await Promise.all([
    settled(loadCatalogueResults(reader, artworkCatalogueFetchQuery(state), shown)),
    settled(reader.countFacets(facetQuery(state))),
    filtered ? settled(reader.countFacets({})) : Promise.resolve(null),
    settled(reader.listCategories()),
  ]);
  if (!results) return { kind: "unavailable" };
  const wholeCatalogue = filtered ? unfilteredFacets : facets;
  const total = catalogueTotal(wholeCatalogue);
  const nothingOnSale = total === 0 || (!filtered && results.total === 0);
  if (nothingOnSale) {
    return {
      kind: "empty",
      countLine: catalogueCountLine({
        resultCount: 0,
        catalogueTotal: 0,
        filtered: false,
        artistNames: [],
      }),
    };
  }
  if (results.total === 0 && state.q) {
    return composeSearchEmpty(reader, { ...state, q: state.q }, wholeCatalogue, categories ?? []);
  }

  const artistLookup = (wholeCatalogue ?? facets)?.artists ?? [];
  const activeChips = buildArtworkCatalogueActiveChips(state, {
    categories: categories ?? [],
    artists: artistLookup,
  });
  const lastChip = activeChips.at(-1);
  const noMatch: CatalogueNoMatchVm | null =
    results.total === 0
      ? {
          remove: lastChip ? { label: lastChip.label, href: lastChip.removeHref } : null,
          clearHref: artworkCatalogueClearHref(state),
          availableNow: await readAvailableNow(reader, wholeCatalogue),
        }
      : null;
  const showsAll = results.items.length >= results.total || shown >= CATALOGUE_MAX_SHOWN;

  return {
    kind: "catalogue",
    countLine: catalogueCountLine({
      resultCount: results.total,
      catalogueTotal: total,
      filtered,
      artistNames: (wholeCatalogue?.artists ?? [])
        .filter((artist) => artist.count > 0)
        .map((artist) => artist.name),
    }),
    liveMessage: editionsLabel(results.total),
    rail: buildCatalogueFilterRail({ state, facets, artists: artistLookup }),
    quickChips: buildCatalogueQuickChips(state, facets),
    activeChips,
    activeCount: activeChips.length,
    results: {
      items: results.items,
      total: results.total,
      loadMoreHref: showsAll ? null : artworkCatalogueLoadMoreHref(state),
    },
    noMatch,
  };
}
