import type { ArtworkCatalogueSort } from "./artwork-catalogue-sort.js";
import { DEFAULT_ARTWORK_CATALOGUE_SORT } from "./artwork-catalogue-sort.js";

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
export type ArtworkObjectTypeFilter = (typeof ARTWORK_OBJECT_TYPES)[number];

export const ARTWORK_RARITIES = ["unique", "limited_edition", "open_edition"] as const;
export type ArtworkRarityFilter = (typeof ARTWORK_RARITIES)[number];

/** A single sale state, or `available` for every work that is not sold (for sale or POA). */
export type ArtworkSaleStateFilter = "for_sale" | "price_on_application" | "sold" | "available";

export type NormalizedArtworkCatalogueFilters = {
  placement?: "featured_originals" | "featured_prints";
  categorySlug?: string;
  artistSlug?: string;
  relatedToSlug?: string;
  salesChannel?: "shop" | "art";
  saleState?: ArtworkSaleStateFilter;
  q?: string;
  artworkType: ArtworkCatalogueType;
  objectType?: ArtworkObjectTypeFilter;
  rarity?: ArtworkRarityFilter;
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
  relatedToSlug?: string;
  salesChannel?: "shop" | "art";
  saleState?: ArtworkSaleStateFilter;
  q?: string;
  artworkType?: ArtworkCatalogueType;
  objectType?: ArtworkObjectTypeFilter;
  rarity?: ArtworkRarityFilter;
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

  let salesChannel = raw.salesChannel;
  if (salesChannel !== undefined && salesChannel !== "shop" && salesChannel !== "art") {
    salesChannel = undefined;
  }

  let objectType = raw.objectType;
  if (objectType && !(ARTWORK_OBJECT_TYPES as readonly string[]).includes(objectType)) {
    objectType = undefined;
  }
  let rarity = raw.rarity;
  if (rarity && !(ARTWORK_RARITIES as readonly string[]).includes(rarity)) {
    rarity = undefined;
  }

  return {
    ...(raw.placement !== undefined ? { placement: raw.placement } : {}),
    ...(raw.categorySlug ? { categorySlug: raw.categorySlug } : {}),
    ...(raw.artistSlug ? { artistSlug: raw.artistSlug } : {}),
    ...(raw.relatedToSlug ? { relatedToSlug: raw.relatedToSlug } : {}),
    ...(salesChannel ? { salesChannel } : {}),
    ...(raw.saleState ? { saleState: raw.saleState } : {}),
    ...(raw.q?.trim() ? { q: raw.q.trim() } : {}),
    artworkType,
    ...(objectType ? { objectType } : {}),
    ...(rarity ? { rarity } : {}),
    ...(minPricePence !== undefined ? { minPricePence } : {}),
    ...(maxPricePence !== undefined ? { maxPricePence } : {}),
    sort: raw.sort ?? DEFAULT_ARTWORK_CATALOGUE_SORT,
    ...(raw.editionEligible !== undefined ? { editionEligible: raw.editionEligible } : {}),
  };
}
