import type { CataloguePriceBandKey, CatalogueSizeBandKey } from "@auction/shop-domain";
import type { ArtworkCatalogueSort } from "./artwork-catalogue-params";

/** The rail's option groups, in order. Availability is the switch above them. */
export const ARTWORK_FILTER_GROUPS = [
  { value: "artist", title: "Artist" },
  { value: "price", title: "Price" },
  { value: "size", title: "Size" },
  { value: "technique", title: "Technique" },
] as const;

export type ArtworkFilterGroupValue = (typeof ARTWORK_FILTER_GROUPS)[number]["value"];

/** Groups open on first view; the shopper's own choices are kept as they collapse them. */
export const ARTWORK_FILTER_DEFAULT_OPEN: ArtworkFilterGroupValue[] = [
  "artist",
  "price",
  "size",
  "technique",
];

/** Each group needs this many options with works; with fewer there is nothing to choose. */
export const MIN_FILTER_GROUP_OPTIONS = 2;

export const ARTWORK_SORT_OPTIONS: ReadonlyArray<{ value: ArtworkCatalogueSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "priceAsc", label: "Price low to high" },
  { value: "priceDesc", label: "Price high to low" },
];

export const PRICE_BAND_LABELS: Record<CataloguePriceBandKey, string> = {
  "under-50": "Under £50",
  "50-100": "£50 to £100",
  "100-300": "£100 to £300",
  "300-plus": "£300 and over",
};

export const SIZE_BAND_LABELS: Record<CatalogueSizeBandKey, string> = {
  small: "Small, under 50 cm",
  medium: "Medium, 50 to 100 cm",
  large: "Large, 100 cm and over",
};

export const AVAILABILITY_LABELS = {
  available: "Available now",
  sold_out: "Sold out",
} as const;
