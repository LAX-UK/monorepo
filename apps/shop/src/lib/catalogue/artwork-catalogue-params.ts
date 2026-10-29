import {
  type CataloguePriceBandKey,
  type CatalogueSizeBandKey,
  cataloguePriceBandRange,
  isCataloguePriceBandKey,
  isCatalogueSizeBandKey,
} from "@auction/shop-domain";

export type CatalogActiveFilterChip = {
  key: string;
  label: string;
  removeHref: string;
};

export const ARTWORK_CATALOGUE_SORTS = ["newest", "priceAsc", "priceDesc"] as const;

export type ArtworkCatalogueSort = (typeof ARTWORK_CATALOGUE_SORTS)[number];

export type ArtworkCatalogueAvailability = "available" | "sold_out";

/** The catalogue as the URL states it. Prices in the URL are whole pounds. */
export type ArtworkCatalogueUrlState = {
  q?: string;
  categorySlug?: string;
  artistSlug?: string;
  /** Can be bought now, or sold out. */
  availability?: ArtworkCatalogueAvailability;
  /** One of the catalogue price bands; wins over a free price range. */
  price?: CataloguePriceBandKey;
  /** A free price range in pounds, from links such as the home page's "Under £150". */
  minPrice?: number;
  maxPrice?: number;
  size?: CatalogueSizeBandKey;
  technique?: string;
  sort: ArtworkCatalogueSort;
  /** How many editions the page shows; "Load more" raises it a page at a time. */
  shown?: number;
};

export type ArtworkCatalogueSearchParams = Record<string, string | string[] | undefined>;

/** Editions per page, and per "Load more". */
export const CATALOGUE_PAGE_SIZE = 24;
/** The most editions one page shows; past this, filters narrow the list. */
export const CATALOGUE_MAX_SHOWN = CATALOGUE_PAGE_SIZE * 8;

function firstString(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

function parseAvailability(
  value: string | undefined,
  legacySaleState: string | undefined,
): ArtworkCatalogueAvailability | undefined {
  if (value === "available" || value === "sold_out") return value;
  // Links from before the availability filter used the sale state.
  if (legacySaleState === "for_sale") return "available";
  if (legacySaleState === "sold") return "sold_out";
  return undefined;
}

function parseSort(value: string | undefined): ArtworkCatalogueSort {
  if (value && (ARTWORK_CATALOGUE_SORTS as readonly string[]).includes(value)) {
    return value as ArtworkCatalogueSort;
  }
  return "newest";
}

/** Whole pages only, from one page up to the most a page shows. */
function parseShown(value: string | undefined): number | undefined {
  const parsed = parseOptionalInt(value);
  if (parsed === undefined || parsed <= CATALOGUE_PAGE_SIZE) return undefined;
  const pages = Math.ceil(parsed / CATALOGUE_PAGE_SIZE);
  return Math.min(pages * CATALOGUE_PAGE_SIZE, CATALOGUE_MAX_SHOWN);
}

function normalizePriceBounds(
  minPrice: number | undefined,
  maxPrice: number | undefined,
): { minPrice?: number; maxPrice?: number } {
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    return { minPrice: maxPrice, maxPrice: minPrice };
  }
  return {
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
  };
}

export function parseArtworkCatalogueParams(
  searchParams: ArtworkCatalogueSearchParams,
): ArtworkCatalogueUrlState {
  const state: ArtworkCatalogueUrlState = {
    sort: parseSort(firstString(searchParams.sort)),
  };
  const q = firstString(searchParams.q)?.trim();
  if (q) state.q = q;
  const categorySlug = firstString(searchParams.categorySlug);
  if (categorySlug) state.categorySlug = categorySlug;
  const artistSlug = firstString(searchParams.artistSlug);
  if (artistSlug) state.artistSlug = artistSlug;
  const availability = parseAvailability(
    firstString(searchParams.availability),
    firstString(searchParams.saleState),
  );
  if (availability) state.availability = availability;
  const price = firstString(searchParams.price);
  if (price && isCataloguePriceBandKey(price)) {
    state.price = price;
  } else {
    const prices = normalizePriceBounds(
      parseOptionalInt(firstString(searchParams.minPrice)),
      parseOptionalInt(firstString(searchParams.maxPrice)),
    );
    if (prices.minPrice !== undefined) state.minPrice = prices.minPrice;
    if (prices.maxPrice !== undefined) state.maxPrice = prices.maxPrice;
  }
  const size = firstString(searchParams.size);
  if (size && isCatalogueSizeBandKey(size)) state.size = size;
  const technique = firstString(searchParams.technique)?.trim();
  if (technique) state.technique = technique;
  const shown = parseShown(firstString(searchParams.shown));
  if (shown !== undefined) state.shown = shown;
  return state;
}

export function artworkCatalogueHref(state: ArtworkCatalogueUrlState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.categorySlug) params.set("categorySlug", state.categorySlug);
  if (state.artistSlug) params.set("artistSlug", state.artistSlug);
  if (state.availability) params.set("availability", state.availability);
  if (state.price) params.set("price", state.price);
  if (state.minPrice !== undefined) params.set("minPrice", String(state.minPrice));
  if (state.maxPrice !== undefined) params.set("maxPrice", String(state.maxPrice));
  if (state.size) params.set("size", state.size);
  if (state.technique) params.set("technique", state.technique);
  if (state.sort !== "newest") params.set("sort", state.sort);
  if (state.shown !== undefined) params.set("shown", String(state.shown));
  const qs = params.toString();
  return qs ? `/artworks?${qs}` : "/artworks";
}

type FilterState = Omit<ArtworkCatalogueUrlState, "shown">;

export type ArtworkCatalogueFilterPatch = {
  [K in keyof FilterState]?: FilterState[K] | null | undefined;
};

/**
 * A filter or sort change, as a link. It starts again from the first page, and a price band
 * replaces any free price range (and the other way round), so only one price filter applies.
 */
export function artworkCatalogueFilterHref(
  state: ArtworkCatalogueUrlState,
  overrides: ArtworkCatalogueFilterPatch = {},
): string {
  const { shown: _shown, ...rest } = state;
  const next: FilterState = { ...rest };
  const patch: ArtworkCatalogueFilterPatch = { ...overrides };
  if (patch.price) {
    patch.minPrice = null;
    patch.maxPrice = null;
  } else if (patch.minPrice != null || patch.maxPrice != null) {
    patch.price = null;
  }
  for (const key of Object.keys(patch) as Array<keyof FilterState>) {
    const value = patch[key];
    if (value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value as never;
    }
  }
  return artworkCatalogueHref(next);
}

/** "Load more": the same list, one page longer. */
export function artworkCatalogueLoadMoreHref(state: ArtworkCatalogueUrlState): string {
  const shown = Math.min(
    (state.shown ?? CATALOGUE_PAGE_SIZE) + CATALOGUE_PAGE_SIZE,
    CATALOGUE_MAX_SHOWN,
  );
  return artworkCatalogueHref({ ...state, shown });
}

/** Every filter off; the sort is kept, since it is not a filter. */
export function artworkCatalogueClearHref(state?: ArtworkCatalogueUrlState): string {
  return artworkCatalogueHref({ sort: state?.sort ?? "newest" });
}

const FILTER_KEYS = [
  "q",
  "categorySlug",
  "artistSlug",
  "availability",
  "price",
  "size",
  "technique",
] as const satisfies ReadonlyArray<keyof FilterState>;

export function countActiveArtworkCatalogueFilters(state: ArtworkCatalogueUrlState): number {
  const set = FILTER_KEYS.filter((key) => state[key] !== undefined).length;
  // A free range counts once, like the band it stands in for.
  const freeRange = state.minPrice !== undefined || state.maxPrice !== undefined ? 1 : 0;
  return set + freeRange;
}

export function artworkCatalogueHasActiveFilters(state: ArtworkCatalogueUrlState): boolean {
  return countActiveArtworkCatalogueFilters(state) > 0;
}

/** What the page asks shop-api for; prices in pence. */
export type ArtworkCatalogueFetchInput = {
  categorySlug?: string;
  artistSlug?: string;
  availability?: ArtworkCatalogueAvailability;
  minPrice?: number;
  maxPrice?: number;
  size?: CatalogueSizeBandKey;
  technique?: string;
  sort?: ArtworkCatalogueSort;
  q?: string;
};

function pricePence(state: ArtworkCatalogueUrlState): { minPrice?: number; maxPrice?: number } {
  if (state.price) {
    const range = cataloguePriceBandRange(state.price);
    return {
      ...(range.from !== undefined ? { minPrice: range.from } : {}),
      // The API's bounds are inclusive; the band's upper bound is not.
      ...(range.below !== undefined ? { maxPrice: range.below - 1 } : {}),
    };
  }
  return {
    ...(state.minPrice !== undefined ? { minPrice: state.minPrice * 100 } : {}),
    ...(state.maxPrice !== undefined ? { maxPrice: state.maxPrice * 100 } : {}),
  };
}

export function artworkCatalogueFetchQuery(
  state: ArtworkCatalogueUrlState,
): ArtworkCatalogueFetchInput {
  return {
    ...(state.q ? { q: state.q } : {}),
    ...(state.categorySlug ? { categorySlug: state.categorySlug } : {}),
    ...(state.artistSlug ? { artistSlug: state.artistSlug } : {}),
    ...(state.availability ? { availability: state.availability } : {}),
    ...pricePence(state),
    ...(state.size ? { size: state.size } : {}),
    ...(state.technique ? { technique: state.technique } : {}),
    ...(state.sort !== "newest" ? { sort: state.sort } : {}),
  };
}
