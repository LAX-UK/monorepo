import {
  type CatalogueArtworkCardVm,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type {
  ArtEditorialExhibitionList,
  ArtEditorialFetchResult,
  ArtEditorialStoryList,
} from "@/lib/editorial/art-editorial.types";
import { type EditorialCardVm, exhibitionCard, storyCard } from "@/lib/editorial/editorial-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type {
  ArtArtworkListQuery,
  ArtCataloguePort,
  ArtEditorialSearchPort,
  ArtFavoritesReadPort,
  ArtViewerPort,
} from "@/lib/ports";
import {
  type SearchArtistLinkVm,
  type SearchTabCount,
  type SearchTabCounts,
  type SearchTabVm,
  buildSearchTabs,
  findExactArtistMatch,
  isArtworkTab,
  resolveActiveTab,
} from "@/lib/search/search-page.vm";
import {
  type SearchSearchParams,
  type SearchTab,
  type SearchUrlState,
  countActiveSearchFilters,
  parseSearchParams,
  searchHref,
} from "@/lib/search/search-params";
import type { PublicArtworkList } from "@auction/shop-contracts";

export const SEARCH_PAGE_SIZE = 24;
const ARTIST_MATCH_LIMIT = 6;

/** What the active tab shows below the toolbar. */
export type SearchPanelVm =
  | {
      kind: "artworks";
      cards: CatalogueArtworkCardVm[];
      count: number;
      nextPageHref: string | null;
    }
  | { kind: "editorial"; cards: EditorialCardVm[]; count: number }
  | { kind: "unavailable" };

export type SearchResultsVm = {
  status: "results";
  query: string;
  state: SearchUrlState;
  activeTab: SearchTab;
  tabs: SearchTabVm[];
  artistLink: SearchArtistLinkVm | null;
  panel: SearchPanelVm;
  activeFilterCount: number;
  /** Nothing matched in any tab and no filter narrowed it (Figma `826:15255`). */
  noResults: boolean;
  favoriteAuth: ArtFavoriteAuth;
};

export type SearchIdleVm = {
  status: "idle";
  query: "";
  /** Cover for the "Browse all" card; null when no artwork has an image. */
  browseImageUrl: string | null;
};

export type SearchUnavailableVm = {
  status: "unavailable";
  query: string;
};

export type SearchPageVm = SearchIdleVm | SearchUnavailableVm | SearchResultsVm;

type SearchServices = {
  catalogue: ArtCataloguePort;
  viewer: ArtViewerPort;
  favorites: ArtFavoritesReadPort;
  editorialSearch: ArtEditorialSearchPort;
};

function artworkQuery(state: SearchUrlState, tab: "available" | "sold"): ArtArtworkListQuery {
  const query: ArtArtworkListQuery = {
    q: state.q,
    saleState: tab === "sold" ? "sold" : (state.availability ?? "available"),
  };
  if (state.objectType) query.objectType = state.objectType;
  // The filter sheet takes whole pounds; the catalogue API filters in pence.
  if (state.minPrice !== undefined) query.minPrice = state.minPrice * 100;
  if (state.maxPrice !== undefined) query.maxPrice = state.maxPrice * 100;
  return query;
}

function listCount(list: PublicArtworkList): number | null {
  if (list.totalCount !== undefined) return list.totalCount;
  return list.nextCursor ? null : list.items.length;
}

function settledCount(result: PromiseSettledResult<PublicArtworkList>): number | null {
  return result.status === "fulfilled" ? listCount(result.value) : null;
}

function editorialCount<T extends { items: unknown[] }>(
  result: ArtEditorialFetchResult<T>,
): SearchTabCount {
  if (result.status === "disabled") return "hidden";
  return result.status === "ok" ? result.data.items.length : null;
}

const UNAVAILABLE_EDITORIAL = { status: "error" } as const;

async function composeIdle(catalogue: ArtCataloguePort): Promise<SearchIdleVm> {
  const objectTypes = await catalogue.listArtworkObjectTypes().catch(() => ({ items: [] }));
  const cover = objectTypes.items.find((item) => item.coverImageUrl)?.coverImageUrl ?? null;
  return { status: "idle", query: "", browseImageUrl: cover };
}

export async function composeSearchPage(
  services: SearchServices,
  searchParams: SearchSearchParams,
): Promise<SearchPageVm> {
  const state = parseSearchParams(searchParams);
  if (!state.q) return composeIdle(services.catalogue);

  const favoritesPromise = loadViewerFavoriteContext(services, searchHref(state));
  const requestedArtworkTab = isArtworkTab(state.tab) ? state.tab : null;
  const pageQuery = (tab: "available" | "sold"): ArtArtworkListQuery =>
    tab === requestedArtworkTab
      ? {
          ...artworkQuery(state, tab),
          limit: SEARCH_PAGE_SIZE,
          sort: state.sort,
          ...(state.cursor ? { cursor: state.cursor } : {}),
        }
      : { ...artworkQuery(state, tab), limit: 1 };

  // One page for the active artwork tab plus a limit-1 read for the other tab's total.
  const [[available, sold], artists, exhibitions, stories] = await Promise.all([
    Promise.allSettled([
      services.catalogue.listArtworks(pageQuery("available")),
      services.catalogue.listArtworks(pageQuery("sold")),
    ]),
    services.catalogue
      .listArtists({ q: state.q, limit: ARTIST_MATCH_LIMIT })
      .then((list) => list.items)
      .catch(() => []),
    services.editorialSearch
      .searchExhibitions(state.q)
      .catch((): ArtEditorialFetchResult<ArtEditorialExhibitionList> => UNAVAILABLE_EDITORIAL),
    services.editorialSearch
      .searchStories(state.q)
      .catch((): ArtEditorialFetchResult<ArtEditorialStoryList> => UNAVAILABLE_EDITORIAL),
  ]);

  const counts: SearchTabCounts = {
    available: settledCount(available),
    sold: settledCount(sold),
    exhibitions: editorialCount(exhibitions),
    articles: editorialCount(stories),
  };
  const editorialReachable = exhibitions.status === "ok" || stories.status === "ok";
  if (available.status === "rejected" && sold.status === "rejected" && !editorialReachable) {
    return { status: "unavailable", query: state.q };
  }

  const activeTab = resolveActiveTab(state.tab, counts);
  const activeState: SearchUrlState =
    activeTab === state.tab ? state : { ...state, tab: activeTab };
  const favorites = await favoritesPromise;
  const artistLink = findExactArtistMatch(artists, state.q);
  const activeFilterCount = countActiveSearchFilters(activeState);

  let panel: SearchPanelVm = { kind: "unavailable" };
  if (isArtworkTab(activeTab)) {
    const result = activeTab === "available" ? available : sold;
    if (result.status === "fulfilled") {
      const cards = buildCatalogueArtworkCards(result.value.items, favorites.savedArtworkSlugs);
      panel = {
        kind: "artworks",
        cards,
        count: listCount(result.value) ?? cards.length,
        nextPageHref: result.value.nextCursor
          ? searchHref({ ...activeState, cursor: result.value.nextCursor })
          : null,
      };
    }
  } else if (activeTab === "exhibitions" && exhibitions.status === "ok") {
    const cards = exhibitions.data.items.map(exhibitionCard);
    panel = { kind: "editorial", cards, count: cards.length };
  } else if (activeTab === "articles" && stories.status === "ok") {
    const cards = stories.data.items.map(storyCard);
    panel = { kind: "editorial", cards, count: cards.length };
  }

  const knownCounts = Object.values(counts).filter((count) => count !== "hidden");
  const noResults =
    activeFilterCount === 0 && artistLink === null && knownCounts.every((count) => count === 0);

  return {
    status: "results",
    query: state.q,
    state: activeState,
    activeTab,
    tabs: buildSearchTabs(activeState, counts),
    artistLink,
    panel,
    activeFilterCount,
    noResults,
    favoriteAuth: favorites.favoriteAuth,
  };
}
