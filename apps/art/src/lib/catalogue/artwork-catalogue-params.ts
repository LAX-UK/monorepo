import { formatGbpPence } from "@auction/shop-portal/vm";

export type CatalogActiveFilterChip = {
  key: string;
  label: string;
  removeHref: string;
};

export const ARTWORK_CATALOGUE_SORTS = ["newest", "titleAsc", "priceAsc", "priceDesc"] as const;

export type ArtworkCatalogueSort = (typeof ARTWORK_CATALOGUE_SORTS)[number];

export const ARTWORK_OBJECT_TYPES = [
  "painting",
  "work_on_paper",
  "sculpture",
  "photography",
  "print",
  "mixed_media",
] as const;
export type ArtworkObjectType = (typeof ARTWORK_OBJECT_TYPES)[number];

/** Rarity as the artwork page describes it; lax.art lists unique works and unrecorded ones. */
export type ArtworkRarity = "unique" | "limited_edition" | "open_edition";

/**
 * One mapping for every object type's names: `plural` names a category (filters, breadcrumbs,
 * tiles), `singular` names one work ("Type: Painting").
 */
export const ARTWORK_OBJECT_TYPE_NAMES: Record<
  ArtworkObjectType,
  { singular: string; plural: string }
> = {
  painting: { singular: "Painting", plural: "Paintings" },
  work_on_paper: { singular: "Work on paper", plural: "Works on paper" },
  sculpture: { singular: "Sculpture", plural: "Sculpture" },
  photography: { singular: "Photograph", plural: "Photography" },
  print: { singular: "Print", plural: "Prints" },
  mixed_media: { singular: "Mixed media", plural: "Mixed media" },
};

function namesBy(form: "singular" | "plural"): Record<ArtworkObjectType, string> {
  return Object.fromEntries(
    Object.entries(ARTWORK_OBJECT_TYPE_NAMES).map(([type, names]) => [type, names[form]]),
  ) as Record<ArtworkObjectType, string>;
}

/** Category names (plural). */
export const ARTWORK_OBJECT_TYPE_LABELS = namesBy("plural");

/** The name of one work's type (singular). */
export const ARTWORK_OBJECT_TYPE_SINGULAR_LABELS = namesBy("singular");

export type ArtworkMediumLanding = {
  path: `/${string}`;
  objectType: ArtworkObjectType;
  title: string;
  metaTitle: string;
  metaDescription: string;
};

/** Legacy thelax.art medium URLs stay live; the catalogue links to them instead of `?objectType=`. */
export const ARTWORK_MEDIUM_LANDINGS = [
  {
    path: "/paintings",
    objectType: "painting",
    title: "Paintings",
    metaTitle: "Paintings for Sale | lax.art",
    metaDescription:
      "Original paintings for sale from emerging and established artists, available to view at lax.art in London.",
  },
  {
    path: "/sculptures",
    objectType: "sculpture",
    title: "Sculptures",
    metaTitle: "Sculptures for Sale | lax.art",
    metaDescription: "Contemporary sculpture for sale from artists represented by lax.art, London.",
  },
] as const satisfies readonly ArtworkMediumLanding[];

/** The legacy landing that owns this medium selection: exactly one medium with its own URL. */
export function artworkMediumLanding(
  objectTypes: readonly ArtworkObjectType[],
): ArtworkMediumLanding | undefined {
  if (objectTypes.length !== 1) return undefined;
  return ARTWORK_MEDIUM_LANDINGS.find((landing) => landing.objectType === objectTypes[0]);
}

export const ARTWORK_RARITY_LABELS: Record<ArtworkRarity, string> = {
  unique: "Unique",
  limited_edition: "Limited edition",
  open_edition: "Open edition",
};

/**
 * Medium and artist are multi-select (any of, via shop-api comma lists); the URL keeps the
 * singular `objectType` / `artistSlug` names so existing links stay valid. lax.art lists originals
 * only, so the old `type` and `rarity` parameters are ignored.
 */
export type ArtworkCatalogueUrlState = {
  q?: string;
  categorySlug?: string;
  artistSlugs: string[];
  saleState?: "for_sale" | "price_on_application" | "sold";
  objectTypes: ArtworkObjectType[];
  minPrice?: number;
  maxPrice?: number;
  sort: ArtworkCatalogueSort;
  cursor?: string | undefined;
  back?: string | undefined;
};

export type ArtworkCatalogueSearchParams = Record<string, string | string[] | undefined>;

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

function parseSaleState(value: string | undefined): ArtworkCatalogueUrlState["saleState"] {
  if (value === "for_sale" || value === "price_on_application" || value === "sold") {
    return value;
  }
  return undefined;
}

/** Accepts `a,b` and repeated params; keeps known values once, in first-seen order. */
function parseList<T extends string>(
  value: string | string[] | undefined,
  allowed?: readonly T[],
): T[] {
  const raw = (Array.isArray(value) ? value : value ? [value] : []).flatMap((v) => v.split(","));
  const out: T[] = [];
  for (const part of raw) {
    const item = part.trim();
    if (!item || out.includes(item as T)) continue;
    if (allowed && !(allowed as readonly string[]).includes(item)) continue;
    out.push(item as T);
  }
  return out;
}

function parseSort(value: string | undefined): ArtworkCatalogueSort {
  if (value && (ARTWORK_CATALOGUE_SORTS as readonly string[]).includes(value)) {
    return value as ArtworkCatalogueSort;
  }
  return "newest";
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
  const prices = normalizePriceBounds(
    parseOptionalInt(firstString(searchParams.minPrice)),
    parseOptionalInt(firstString(searchParams.maxPrice)),
  );
  const state: ArtworkCatalogueUrlState = {
    sort: parseSort(firstString(searchParams.sort)),
    artistSlugs: parseList<string>(searchParams.artistSlug),
    objectTypes: parseList(searchParams.objectType, ARTWORK_OBJECT_TYPES),
  };
  const q = firstString(searchParams.q)?.trim();
  if (q) state.q = q;
  const categorySlug = firstString(searchParams.categorySlug);
  if (categorySlug) state.categorySlug = categorySlug;
  const saleState = parseSaleState(firstString(searchParams.saleState));
  if (saleState) state.saleState = saleState;
  if (prices.minPrice !== undefined) state.minPrice = prices.minPrice;
  if (prices.maxPrice !== undefined) state.maxPrice = prices.maxPrice;
  const cursor = firstString(searchParams.cursor);
  if (cursor) state.cursor = cursor;
  const back = firstString(searchParams.back);
  if (back) state.back = back;
  return state;
}

export function artworkCatalogueHref(
  state: ArtworkCatalogueUrlState,
  overrides: Partial<ArtworkCatalogueUrlState> = {},
): string {
  const next = { ...state, ...overrides };
  const landing = artworkMediumLanding(next.objectTypes);
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.categorySlug) params.set("categorySlug", next.categorySlug);
  if (next.artistSlugs.length > 0) params.set("artistSlug", next.artistSlugs.join(","));
  if (next.saleState) params.set("saleState", next.saleState);
  if (next.objectTypes.length > 0 && !landing) {
    params.set("objectType", next.objectTypes.join(","));
  }
  if (next.minPrice !== undefined) params.set("minPrice", String(next.minPrice));
  if (next.maxPrice !== undefined) params.set("maxPrice", String(next.maxPrice));
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.cursor) params.set("cursor", next.cursor);
  if (next.back) params.set("back", next.back);
  // Commas stay literal so shared links read `objectType=painting,print`.
  const qs = params.toString().replaceAll("%2C", ",");
  const path = landing?.path ?? "/artworks";
  return qs ? `${path}?${qs}` : path;
}

type ArtworkCatalogueFilterFields = Omit<ArtworkCatalogueUrlState, "cursor" | "back">;

/** `null` clears a field; list fields clear with `null` or `[]`. */
export type ArtworkCatalogueFilterPatch = {
  [K in keyof ArtworkCatalogueFilterFields]?: ArtworkCatalogueFilterFields[K] | null | undefined;
};

const EMPTY_LISTS = { artistSlugs: [], objectTypes: [] } as const;

/** Filter/sort changes clear cursor history. */
export function artworkCatalogueFilterHref(
  state: ArtworkCatalogueUrlState,
  overrides: ArtworkCatalogueFilterPatch = {},
): string {
  const { cursor: _c, back: _b, ...rest } = state;
  const next: ArtworkCatalogueFilterFields = { ...rest };
  for (const key of Object.keys(overrides) as Array<keyof typeof overrides>) {
    const value = overrides[key];
    if (value !== null && value !== undefined) {
      next[key] = value as never;
    } else if (key in EMPTY_LISTS) {
      next[key as keyof typeof EMPTY_LISTS] = [];
    } else {
      delete next[key];
    }
  }
  return artworkCatalogueHref(next);
}

/** The unfiltered catalogue; a fresh object each call so callers may extend its lists. */
export function emptyArtworkCatalogueState(): ArtworkCatalogueUrlState {
  return { sort: "newest", artistSlugs: [], objectTypes: [] };
}

export function artworkCatalogueClearHref(): string {
  return artworkCatalogueHref(emptyArtworkCatalogueState());
}

export function countActiveArtworkCatalogueFilters(state: ArtworkCatalogueUrlState): number {
  let count = 0;
  if (state.q) count += 1;
  if (state.categorySlug) count += 1;
  count += state.artistSlugs.length;
  if (state.saleState) count += 1;
  count += state.objectTypes.length;
  if (state.minPrice !== undefined) count += 1;
  if (state.maxPrice !== undefined) count += 1;
  return count;
}

const SALE_STATE_LABELS: Record<NonNullable<ArtworkCatalogueUrlState["saleState"]>, string> = {
  for_sale: "For sale",
  price_on_application: "Price on request",
  sold: "Sold",
};

export function buildArtworkCatalogueActiveChips(
  state: ArtworkCatalogueUrlState,
  lookups: {
    categories: ReadonlyArray<{ slug: string; label: string }>;
    artists: ReadonlyArray<{ slug: string; label: string }>;
  },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  if (state.q) {
    chips.push({
      key: "q",
      label: `Search: ${state.q}`,
      removeHref: artworkCatalogueFilterHref(state, { q: null }),
    });
  }
  if (state.saleState) {
    chips.push({
      key: "saleState",
      label: SALE_STATE_LABELS[state.saleState],
      removeHref: artworkCatalogueFilterHref(state, { saleState: null }),
    });
  }
  for (const objectType of state.objectTypes) {
    chips.push({
      key: `objectType:${objectType}`,
      label: ARTWORK_OBJECT_TYPE_LABELS[objectType],
      removeHref: artworkCatalogueFilterHref(state, {
        objectTypes: state.objectTypes.filter((value) => value !== objectType),
      }),
    });
  }
  if (state.categorySlug) {
    const label =
      lookups.categories.find((c) => c.slug === state.categorySlug)?.label ?? state.categorySlug;
    chips.push({
      key: "category",
      label,
      removeHref: artworkCatalogueFilterHref(state, { categorySlug: null }),
    });
  }
  for (const artistSlug of state.artistSlugs) {
    chips.push({
      key: `artist:${artistSlug}`,
      label: lookups.artists.find((a) => a.slug === artistSlug)?.label ?? artistSlug,
      removeHref: artworkCatalogueFilterHref(state, {
        artistSlugs: state.artistSlugs.filter((value) => value !== artistSlug),
      }),
    });
  }
  if (state.minPrice !== undefined || state.maxPrice !== undefined) {
    let label: string;
    if (state.minPrice !== undefined && state.maxPrice !== undefined) {
      label = `${formatGbpPence(state.minPrice * 100)}–${formatGbpPence(state.maxPrice * 100)}`;
    } else if (state.minPrice !== undefined) {
      label = `From ${formatGbpPence(state.minPrice * 100)}`;
    } else {
      label = `Up to ${formatGbpPence((state.maxPrice ?? 0) * 100)}`;
    }
    chips.push({
      key: "price",
      label,
      removeHref: artworkCatalogueFilterHref(state, { minPrice: null, maxPrice: null }),
    });
  }
  return chips;
}

export function artworkCatalogueHasActiveFilters(state: ArtworkCatalogueUrlState): boolean {
  return countActiveArtworkCatalogueFilters(state) > 0;
}

export function artworkCataloguePageTitle(state: ArtworkCatalogueUrlState): string {
  const landing = artworkMediumLanding(state.objectTypes);
  return landing?.title ?? "Artworks";
}

export type ArtworkCatalogueFetchInput = {
  limit?: number;
  cursor?: string;
  categorySlug?: string;
  artistSlugs?: string[];
  saleState?: "for_sale" | "price_on_application" | "sold";
  objectTypes?: ArtworkObjectType[];
  minPrice?: number;
  maxPrice?: number;
  sort?: ArtworkCatalogueSort;
  q?: string;
};

export function artworkCatalogueFetchQuery(
  state: ArtworkCatalogueUrlState,
): ArtworkCatalogueFetchInput {
  const query: ArtworkCatalogueFetchInput = {};
  if (state.q) query.q = state.q;
  if (state.categorySlug) query.categorySlug = state.categorySlug;
  if (state.artistSlugs.length > 0) query.artistSlugs = state.artistSlugs;
  if (state.saleState) query.saleState = state.saleState;
  if (state.objectTypes.length > 0) query.objectTypes = state.objectTypes;
  if (state.minPrice !== undefined) query.minPrice = state.minPrice * 100;
  if (state.maxPrice !== undefined) query.maxPrice = state.maxPrice * 100;
  if (state.sort !== "newest") query.sort = state.sort;
  if (state.cursor) query.cursor = state.cursor;
  return query;
}

export function artworkCataloguePagerHref(
  state: ArtworkCatalogueUrlState,
  overrides: { cursor?: string | null; back?: string | null },
): string {
  const next = { ...state };
  if ("cursor" in overrides) {
    next.cursor = overrides.cursor ?? undefined;
  }
  if ("back" in overrides) {
    next.back = overrides.back ?? undefined;
  }
  return artworkCatalogueHref(next);
}
