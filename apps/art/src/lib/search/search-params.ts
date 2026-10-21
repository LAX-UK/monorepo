import {
  ARTWORK_CATALOGUE_SORTS,
  ARTWORK_OBJECT_TYPES,
  type ArtworkCatalogueSort,
  type ArtworkObjectType,
} from "@/lib/catalogue/artwork-catalogue-params";

export const SEARCH_QUERY_MAX_LENGTH = 120;

export const SEARCH_TABS = ["available", "sold", "exhibitions", "articles"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

/** Narrows the Available tab; Sold has a single state. */
export type SearchAvailability = "for_sale" | "price_on_application";

/** Facets that apply to the artwork tabs (Available and Sold). */
export type SearchArtworkFilters = {
  availability?: SearchAvailability;
  objectType?: ArtworkObjectType;
  /** Whole pounds, as typed in the filter sheet. */
  minPrice?: number;
  maxPrice?: number;
};

export type SearchUrlState = SearchArtworkFilters & {
  q: string;
  tab: SearchTab;
  sort: ArtworkCatalogueSort;
  cursor?: string;
};

export type SearchSearchParams = Record<string, string | string[] | undefined>;

export type SearchStatePatch = {
  [K in keyof Omit<SearchUrlState, "q" | "cursor">]?: SearchUrlState[K] | null;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function member<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function wholeNumber(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number.parseInt(value, 10);
}

export function parseSearchQuery(raw: string | string[] | undefined): string {
  return (first(raw) ?? "").trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
}

export function parseSearchParams(params: SearchSearchParams): SearchUrlState {
  const state: SearchUrlState = {
    q: parseSearchQuery(params.q),
    tab: member(first(params.tab), SEARCH_TABS) ?? "available",
    sort: member(first(params.sort), ARTWORK_CATALOGUE_SORTS) ?? "newest",
  };
  const availability = member(first(params.availability), [
    "for_sale",
    "price_on_application",
  ] as const);
  if (availability && state.tab === "available") state.availability = availability;
  const objectType = member(first(params.objectType), ARTWORK_OBJECT_TYPES);
  if (objectType) state.objectType = objectType;
  let minPrice = wholeNumber(first(params.minPrice));
  let maxPrice = wholeNumber(first(params.maxPrice));
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  if (minPrice !== undefined) state.minPrice = minPrice;
  if (maxPrice !== undefined) state.maxPrice = maxPrice;
  const cursor = first(params.cursor);
  if (cursor) state.cursor = cursor;
  return state;
}

export function searchHref(state: SearchUrlState): string {
  if (!state.q) return "/search";
  const params = new URLSearchParams({ q: state.q });
  if (state.tab !== "available") params.set("tab", state.tab);
  if (state.sort !== "newest") params.set("sort", state.sort);
  if (state.availability) params.set("availability", state.availability);
  if (state.objectType) params.set("objectType", state.objectType);
  if (state.minPrice !== undefined) params.set("minPrice", String(state.minPrice));
  if (state.maxPrice !== undefined) params.set("maxPrice", String(state.maxPrice));
  if (state.cursor) params.set("cursor", state.cursor);
  return `/search?${params.toString()}`;
}

/** Any filter, sort or tab change starts again from the first page. */
export function searchFilterHref(state: SearchUrlState, patch: SearchStatePatch): string {
  const { cursor: _cursor, ...next } = state;
  for (const key of Object.keys(patch) as Array<keyof SearchStatePatch>) {
    const value = patch[key];
    if (value === null || value === undefined) delete next[key];
    else next[key] = value as never;
  }
  // Availability only narrows the Available tab.
  const { availability: _availability, ...withoutAvailability } = next;
  return searchHref(next.tab === "available" ? next : withoutAvailability);
}

export function countActiveSearchFilters(state: SearchUrlState): number {
  return [state.availability, state.objectType, state.minPrice, state.maxPrice].filter(
    (value) => value !== undefined,
  ).length;
}

export function searchClearFiltersHref(state: SearchUrlState): string {
  return searchFilterHref(state, {
    availability: null,
    objectType: null,
    minPrice: null,
    maxPrice: null,
  });
}
