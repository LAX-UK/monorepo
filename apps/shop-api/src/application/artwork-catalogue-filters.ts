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
  /** Any of these artists (OR). */
  artistSlugs?: string[];
  relatedToSlug?: string;
  /** Editions made from this original (by the original's slug). */
  sourceOriginalSlug?: string;
  salesChannel?: "shop" | "art";
  saleState?: ArtworkSaleStateFilter;
  q?: string;
  artworkType: ArtworkCatalogueType;
  /** Any of these object types (OR). */
  objectTypes?: ArtworkObjectTypeFilter[];
  /** Any of these rarities (OR). */
  rarities?: ArtworkRarityFilter[];
  minPricePence?: number;
  maxPricePence?: number;
  sort: ArtworkCatalogueSort;
  /** @deprecated Prefer artworkType=edition */
  editionEligible?: boolean;
};

export type RawArtworkCatalogueFilters = {
  placement?: "featured_originals" | "featured_prints";
  categorySlug?: string;
  artistSlugs?: readonly string[];
  relatedToSlug?: string;
  sourceOriginalSlug?: string;
  salesChannel?: "shop" | "art";
  saleState?: ArtworkSaleStateFilter;
  q?: string;
  artworkType?: ArtworkCatalogueType;
  objectTypes?: readonly string[];
  rarities?: readonly string[];
  minPricePence?: number;
  maxPricePence?: number;
  sort?: ArtworkCatalogueSort;
  editionEligible?: boolean;
};

/** Bounds the SQL `IN (…)` a single public request can build; no real facet selection gets close. */
export const MAX_FILTER_LIST_VALUES = 50;

/** Trimmed, de-duplicated values; only `allowed` members survive when given. */
function normalizeList<T extends string>(
  values: readonly string[] | undefined,
  allowed?: readonly T[],
): T[] {
  const out: T[] = [];
  for (const raw of values ?? []) {
    if (out.length === MAX_FILTER_LIST_VALUES) break;
    const value = raw.trim();
    if (!value || out.includes(value as T)) continue;
    if (allowed && !(allowed as readonly string[]).includes(value)) continue;
    out.push(value as T);
  }
  return out;
}

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

  const artistSlugs = normalizeList<string>(raw.artistSlugs);
  const objectTypes = normalizeList(raw.objectTypes, ARTWORK_OBJECT_TYPES);
  const rarities = normalizeList(raw.rarities, ARTWORK_RARITIES);

  return {
    ...(raw.placement !== undefined ? { placement: raw.placement } : {}),
    ...(raw.categorySlug ? { categorySlug: raw.categorySlug } : {}),
    ...(artistSlugs.length > 0 ? { artistSlugs } : {}),
    ...(raw.relatedToSlug ? { relatedToSlug: raw.relatedToSlug } : {}),
    ...(raw.sourceOriginalSlug?.trim()
      ? { sourceOriginalSlug: raw.sourceOriginalSlug.trim() }
      : {}),
    ...(salesChannel ? { salesChannel } : {}),
    ...(raw.saleState ? { saleState: raw.saleState } : {}),
    ...(raw.q?.trim() ? { q: raw.q.trim() } : {}),
    artworkType,
    ...(objectTypes.length > 0 ? { objectTypes } : {}),
    ...(rarities.length > 0 ? { rarities } : {}),
    ...(minPricePence !== undefined ? { minPricePence } : {}),
    ...(maxPricePence !== undefined ? { maxPricePence } : {}),
    sort: raw.sort ?? DEFAULT_ARTWORK_CATALOGUE_SORT,
    ...(raw.editionEligible !== undefined ? { editionEligible: raw.editionEligible } : {}),
  };
}
