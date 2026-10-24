import type { ArtworkCatalogueSort } from "./artwork-catalogue-params";

export const ARTWORK_FILTER_GROUPS = [
  { value: "availability", title: "Availability" },
  { value: "category", title: "Category" },
  { value: "artist", title: "Artist" },
  { value: "price", title: "Price" },
] as const;

export type ArtworkFilterGroupValue = (typeof ARTWORK_FILTER_GROUPS)[number]["value"];

export const ARTWORK_FILTER_DEFAULT_OPEN: ArtworkFilterGroupValue[] = ["availability", "category"];

export const ARTWORK_SALE_STATE_OPTIONS = [
  { value: "", label: "Any availability" },
  { value: "for_sale", label: "For sale" },
  { value: "sold", label: "Sold" },
] as const;

export const ARTWORK_SORT_OPTIONS: ReadonlyArray<{
  value: ArtworkCatalogueSort;
  label: string;
}> = [
  { value: "newest", label: "Newest" },
  { value: "titleAsc", label: "Title (A–Z)" },
  { value: "priceAsc", label: "Price (low–high)" },
  { value: "priceDesc", label: "Price (high–low)" },
];
