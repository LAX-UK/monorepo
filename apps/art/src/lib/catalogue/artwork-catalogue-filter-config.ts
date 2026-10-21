import {
  ARTWORK_OBJECT_TYPES,
  ARTWORK_OBJECT_TYPE_LABELS,
  ARTWORK_RARITIES,
  ARTWORK_RARITY_LABELS,
  type ArtworkCatalogueFilterPatch,
  type ArtworkCatalogueSort,
  type ArtworkCatalogueType,
  type ArtworkCatalogueUrlState,
  type ArtworkObjectType,
} from "./artwork-catalogue-params";

export type ArtworkFilterOption<T extends string = string> = { value: T; label: string };

/** Drawer order follows Figma 541:6507 (Department, Sort, Artist), then the facets with data. */
export const ARTWORK_FILTER_GROUPS = [
  { value: "type", title: "Department" },
  { value: "sort", title: "Sort by" },
  { value: "artist", title: "Artist" },
  { value: "objectType", title: "Medium" },
  { value: "rarity", title: "Rarity" },
  { value: "category", title: "Category" },
  { value: "availability", title: "Availability" },
  { value: "price", title: "Price" },
] as const;

export type ArtworkFilterGroupValue = (typeof ARTWORK_FILTER_GROUPS)[number]["value"];

/** Figma draws every section expanded; Artist and Category can run long, so they start closed. */
export const ARTWORK_FILTER_DEFAULT_OPEN: ArtworkFilterGroupValue[] = [
  "type",
  "sort",
  "objectType",
  "rarity",
  "availability",
  "price",
];

export const ARTWORK_TYPE_OPTIONS: ReadonlyArray<ArtworkFilterOption<ArtworkCatalogueType>> = [
  { value: "all", label: "All artworks" },
  { value: "original", label: "Originals" },
  { value: "edition", label: "Prints & multiples" },
];

/** `""` means "no filter" in the single-select facets. */
export const ARTWORK_SALE_STATE_OPTIONS: ReadonlyArray<
  ArtworkFilterOption<NonNullable<ArtworkCatalogueUrlState["saleState"]> | "">
> = [
  { value: "", label: "Any availability" },
  { value: "for_sale", label: "For sale" },
  { value: "price_on_application", label: "Price on request" },
  { value: "sold", label: "Sold" },
];

/** Only orders shop-api can sort by; Figma's oldest-first has no API support. */
export const ARTWORK_SORT_OPTIONS: ReadonlyArray<ArtworkFilterOption<ArtworkCatalogueSort>> = [
  { value: "newest", label: "Newest" },
  { value: "titleAsc", label: "Title (A–Z)" },
  { value: "priceAsc", label: "Price (low–high)" },
  { value: "priceDesc", label: "Price (high–low)" },
];

export const ARTWORK_OBJECT_TYPE_OPTIONS: ReadonlyArray<ArtworkFilterOption<ArtworkObjectType>> =
  ARTWORK_OBJECT_TYPES.map((value) => ({ value, label: ARTWORK_OBJECT_TYPE_LABELS[value] }));

export const ARTWORK_RARITY_OPTIONS = ARTWORK_RARITIES.map((value) => ({
  value,
  label: ARTWORK_RARITY_LABELS[value],
}));

type PriceBand = { value: string; label: string; minPrice?: number; maxPrice?: number };

/** Toolbar "Price range" presets in whole pounds; the drawer keeps free min/max entry. */
export const ARTWORK_PRICE_BANDS: readonly PriceBand[] = [
  { value: "under-1000", label: "Under £1,000", maxPrice: 1000 },
  { value: "1000-5000", label: "£1,000 – £5,000", minPrice: 1000, maxPrice: 5000 },
  { value: "5000-10000", label: "£5,000 – £10,000", minPrice: 5000, maxPrice: 10000 },
  { value: "10000-25000", label: "£10,000 – £25,000", minPrice: 10000, maxPrice: 25000 },
  { value: "over-25000", label: "Over £25,000", minPrice: 25000 },
];

export const ARTWORK_PRICE_BAND_OPTIONS: readonly ArtworkFilterOption[] = [
  { value: "", label: "Any price" },
  ...ARTWORK_PRICE_BANDS.map(({ value, label }) => ({ value, label })),
];

/** The preset matching the applied range exactly; `""` for no range or a custom one. */
export function artworkPriceBandValue(state: ArtworkCatalogueUrlState): string {
  if (state.minPrice === undefined && state.maxPrice === undefined) return "";
  const band = ARTWORK_PRICE_BANDS.find(
    (b) => b.minPrice === state.minPrice && b.maxPrice === state.maxPrice,
  );
  return band?.value ?? "";
}

export function artworkPriceBandPatch(value: string): ArtworkCatalogueFilterPatch {
  const band = ARTWORK_PRICE_BANDS.find((b) => b.value === value);
  return { minPrice: band?.minPrice ?? null, maxPrice: band?.maxPrice ?? null };
}
