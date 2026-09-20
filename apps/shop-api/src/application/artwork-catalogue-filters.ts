import type { ArtworkCatalogueSort } from "./artwork-catalogue-sort.js";
import { DEFAULT_ARTWORK_CATALOGUE_SORT } from "./artwork-catalogue-sort.js";

export const ARTWORK_CATALOGUE_TYPES = ["all", "original", "edition"] as const;
export type ArtworkCatalogueType = (typeof ARTWORK_CATALOGUE_TYPES)[number];

export type NormalizedArtworkCatalogueFilters = {
  placement?: "featured_originals" | "featured_prints";
  categorySlug?: string;
  artistSlug?: string;
  saleState?: "for_sale" | "price_on_application" | "sold";
  q?: string;
  artworkType: ArtworkCatalogueType;
  minPricePence?: number;
  maxPricePence?: number;
  sort: ArtworkCatalogueSort;
  /** @deprecated Prefer artworkType=edition */
  editionEligible?: boolean;
};

export type RawArtworkCatalogueFilters = {
  placement?: "featured_originals" | "featured_prints";
  categorySlug?: string;
  artistSlug?: string;
  saleState?: "for_sale" | "price_on_application" | "sold";
  q?: string;
  artworkType?: ArtworkCatalogueType;
  minPricePence?: number;
  maxPricePence?: number;
  sort?: ArtworkCatalogueSort;
  editionEligible?: boolean;
};

function parseInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return undefined;
  }
  return value;
}

export function normalizeArtworkCatalogueFilters(
  raw: RawArtworkCatalogueFilters,
): NormalizedArtworkCatalogueFilters {
  let minPricePence = parseInteger(raw.minPricePence);
  let maxPricePence = parseInteger(raw.maxPricePence);
  if (minPricePence !== undefined && maxPricePence !== undefined && minPricePence > maxPricePence) {
    [minPricePence, maxPricePence] = [maxPricePence, minPricePence];
  }

  let artworkType: ArtworkCatalogueType = raw.artworkType ?? "all";
  if (artworkType === "all" && raw.editionEligible === true) {
    artworkType = "edition";
  }
  if (!(ARTWORK_CATALOGUE_TYPES as readonly string[]).includes(artworkType)) {
    artworkType = "all";
  }

  return {
    ...(raw.placement !== undefined ? { placement: raw.placement } : {}),
    ...(raw.categorySlug ? { categorySlug: raw.categorySlug } : {}),
    ...(raw.artistSlug ? { artistSlug: raw.artistSlug } : {}),
    ...(raw.saleState ? { saleState: raw.saleState } : {}),
    ...(raw.q?.trim() ? { q: raw.q.trim() } : {}),
    artworkType,
    ...(minPricePence !== undefined ? { minPricePence } : {}),
    ...(maxPricePence !== undefined ? { maxPricePence } : {}),
    sort: raw.sort ?? DEFAULT_ARTWORK_CATALOGUE_SORT,
    ...(raw.editionEligible !== undefined ? { editionEligible: raw.editionEligible } : {}),
  };
}
