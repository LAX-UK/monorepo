import { formatGbpPence } from "@auction/shop-portal/vm";

export type CatalogActiveFilterChip = {
  key: string;
  label: string;
  removeHref: string;
};

export const ARTWORK_CATALOGUE_SORTS = ["newest", "titleAsc", "priceAsc", "priceDesc"] as const;

export type ArtworkCatalogueSort = (typeof ARTWORK_CATALOGUE_SORTS)[number];

export const ARTWORK_CATALOGUE_TYPES = ["all", "original", "edition"] as const;
export type ArtworkCatalogueType = (typeof ARTWORK_CATALOGUE_TYPES)[number];

export const ARTWORK_OBJECT_TYPES = [
  "painting",
  "work_on_paper",
  "sculpture",
  "photography",
  "print",
  "mixed_media",
] as const;
export type ArtworkObjectType = (typeof ARTWORK_OBJECT_TYPES)[number];

export const ARTWORK_RARITIES = ["unique", "limited_edition", "open_edition"] as const;
export type ArtworkRarity = (typeof ARTWORK_RARITIES)[number];

export const ARTWORK_OBJECT_TYPE_LABELS: Record<ArtworkObjectType, string> = {
  painting: "Paintings",
  work_on_paper: "Works on paper",
  sculpture: "Sculpture",
  photography: "Photography",
  print: "Prints",
  mixed_media: "Mixed media",
};

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
    metaTitle: "Paintings for Sale | LAX Art",
    metaDescription:
      "Original paintings for sale from emerging and established artists, available to view at LAX Art in London.",
  },
  {
    path: "/prints",
    objectType: "print",
    title: "Prints",
    metaTitle: "Art Prints for Sale | LAX Art",
    metaDescription:
      "Limited edition and open edition art prints for sale, chosen by the LAX Art gallery in London.",
  },
  {
    path: "/sculptures",
    objectType: "sculpture",
    title: "Sculptures",
    metaTitle: "Sculptures for Sale | LAX Art",
    metaDescription: "Contemporary sculpture for sale from artists represented by LAX Art, London.",
  },
] as const satisfies readonly ArtworkMediumLanding[];

export function artworkMediumLanding(
  objectType: ArtworkObjectType | undefined,
): ArtworkMediumLanding | undefined {
  return ARTWORK_MEDIUM_LANDINGS.find((landing) => landing.objectType === objectType);
}

export const ARTWORK_RARITY_LABELS: Record<ArtworkRarity, string> = {
  unique: "Unique",
  limited_edition: "Limited edition",
  open_edition: "Open edition",
};

export type ArtworkCatalogueUrlState = {
  q?: string;
  categorySlug?: string;
  artistSlug?: string;
  saleState?: "for_sale" | "price_on_application" | "sold";
  type: ArtworkCatalogueType;
  objectType?: ArtworkObjectType;
  rarity?: ArtworkRarity;
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

function parseMember<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function parseSort(value: string | undefined): ArtworkCatalogueSort {
  if (value && (ARTWORK_CATALOGUE_SORTS as readonly string[]).includes(value)) {
    return value as ArtworkCatalogueSort;
  }
  return "newest";
}

function parseType(
  typeRaw: string | undefined,
  editionEligibleRaw: string | undefined,
): ArtworkCatalogueType {
  if (typeRaw && (ARTWORK_CATALOGUE_TYPES as readonly string[]).includes(typeRaw)) {
    return typeRaw as ArtworkCatalogueType;
  }
  if (editionEligibleRaw === "true") return "edition";
  return "all";
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
    type: parseType(firstString(searchParams.type), firstString(searchParams.editionEligible)),
    sort: parseSort(firstString(searchParams.sort)),
  };
  const q = firstString(searchParams.q)?.trim();
  if (q) state.q = q;
  const categorySlug = firstString(searchParams.categorySlug);
  if (categorySlug) state.categorySlug = categorySlug;
  const artistSlug = firstString(searchParams.artistSlug);
  if (artistSlug) state.artistSlug = artistSlug;
  const saleState = parseSaleState(firstString(searchParams.saleState));
  if (saleState) state.saleState = saleState;
  const objectType = parseMember(firstString(searchParams.objectType), ARTWORK_OBJECT_TYPES);
  if (objectType) state.objectType = objectType;
  const rarity = parseMember(firstString(searchParams.rarity), ARTWORK_RARITIES);
  if (rarity) state.rarity = rarity;
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
  const landing = artworkMediumLanding(next.objectType);
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.categorySlug) params.set("categorySlug", next.categorySlug);
  if (next.artistSlug) params.set("artistSlug", next.artistSlug);
  if (next.saleState) params.set("saleState", next.saleState);
  if (next.type !== "all") params.set("type", next.type);
  if (next.objectType && !landing) params.set("objectType", next.objectType);
  if (next.rarity) params.set("rarity", next.rarity);
  if (next.minPrice !== undefined) params.set("minPrice", String(next.minPrice));
  if (next.maxPrice !== undefined) params.set("maxPrice", String(next.maxPrice));
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.cursor) params.set("cursor", next.cursor);
  if (next.back) params.set("back", next.back);
  const qs = params.toString();
  const path = landing?.path ?? "/artworks";
  return qs ? `${path}?${qs}` : path;
}

export type ArtworkCatalogueFilterPatch = {
  [K in keyof Omit<ArtworkCatalogueUrlState, "cursor" | "back">]?:
    | Omit<ArtworkCatalogueUrlState, "cursor" | "back">[K]
    | null
    | undefined;
};

/** Filter/sort changes clear cursor history. */
export function artworkCatalogueFilterHref(
  state: ArtworkCatalogueUrlState,
  overrides: ArtworkCatalogueFilterPatch = {},
): string {
  const { cursor: _c, back: _b, ...rest } = state;
  const next: Omit<ArtworkCatalogueUrlState, "cursor" | "back"> = { ...rest };
  for (const key of Object.keys(overrides) as Array<keyof typeof overrides>) {
    const value = overrides[key];
    if (value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value as never;
    }
  }
  return artworkCatalogueHref(next);
}

export function artworkCatalogueClearHref(): string {
  return artworkCatalogueHref({ type: "all", sort: "newest" });
}

export function countActiveArtworkCatalogueFilters(state: ArtworkCatalogueUrlState): number {
  let count = 0;
  if (state.q) count += 1;
  if (state.categorySlug) count += 1;
  if (state.artistSlug) count += 1;
  if (state.saleState) count += 1;
  if (state.type !== "all") count += 1;
  if (state.objectType) count += 1;
  if (state.rarity) count += 1;
  if (state.minPrice !== undefined) count += 1;
  if (state.maxPrice !== undefined) count += 1;
  return count;
}

const SALE_STATE_LABELS: Record<NonNullable<ArtworkCatalogueUrlState["saleState"]>, string> = {
  for_sale: "For sale",
  price_on_application: "Price on request",
  sold: "Sold",
};

const TYPE_LABELS: Record<ArtworkCatalogueType, string> = {
  all: "All artworks",
  original: "Originals",
  edition: "Prints & multiples",
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
  if (state.type !== "all") {
    chips.push({
      key: "type",
      label: TYPE_LABELS[state.type],
      removeHref: artworkCatalogueFilterHref(state, { type: "all" }),
    });
  }
  if (state.saleState) {
    chips.push({
      key: "saleState",
      label: SALE_STATE_LABELS[state.saleState],
      removeHref: artworkCatalogueFilterHref(state, { saleState: null }),
    });
  }
  if (state.objectType) {
    chips.push({
      key: "objectType",
      label: ARTWORK_OBJECT_TYPE_LABELS[state.objectType],
      removeHref: artworkCatalogueFilterHref(state, { objectType: null }),
    });
  }
  if (state.rarity) {
    chips.push({
      key: "rarity",
      label: ARTWORK_RARITY_LABELS[state.rarity],
      removeHref: artworkCatalogueFilterHref(state, { rarity: null }),
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
  if (state.artistSlug) {
    const label =
      lookups.artists.find((a) => a.slug === state.artistSlug)?.label ?? state.artistSlug;
    chips.push({
      key: "artist",
      label,
      removeHref: artworkCatalogueFilterHref(state, { artistSlug: null }),
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
  const landing = artworkMediumLanding(state.objectType);
  if (landing) return landing.title;
  if (state.type === "edition") return "Prints & Multiples";
  return "Artworks";
}

export type ArtworkCatalogueFetchInput = {
  limit?: number;
  cursor?: string;
  categorySlug?: string;
  artistSlug?: string;
  saleState?: "for_sale" | "price_on_application" | "sold";
  type?: ArtworkCatalogueType;
  objectType?: ArtworkObjectType;
  rarity?: ArtworkRarity;
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
  if (state.artistSlug) query.artistSlug = state.artistSlug;
  if (state.saleState) query.saleState = state.saleState;
  if (state.type !== "all") query.type = state.type;
  if (state.objectType) query.objectType = state.objectType;
  if (state.rarity) query.rarity = state.rarity;
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
