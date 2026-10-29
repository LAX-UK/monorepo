/**
 * The fixed bands the Shop catalogue filters and counts by. One table serves shop-api (the SQL
 * filters and the facet counts) and the storefront (the rail, the quick chips and their links),
 * so a band always means the same works on both sides. Ranges are half-open (`from` included,
 * `below` excluded), so neighbouring bands never overlap.
 */

export type CatalogueBandRange = {
  /** Included lower bound; absent means no lower bound. */
  from?: number;
  /** Excluded upper bound; absent means no upper bound. */
  below?: number;
};

/** Edition prices in pence, incl. VAT: under £50, £50 to £100, £100 to £300, £300 and over. */
export const CATALOGUE_PRICE_BANDS = [
  { key: "under-50", pence: { below: 5_000 } },
  { key: "50-100", pence: { from: 5_000, below: 10_000 } },
  { key: "100-300", pence: { from: 10_000, below: 30_000 } },
  { key: "300-plus", pence: { from: 30_000 } },
] as const satisfies ReadonlyArray<{ key: string; pence: CatalogueBandRange }>;

export type CataloguePriceBandKey = (typeof CATALOGUE_PRICE_BANDS)[number]["key"];

/**
 * Sizes by the longest side of the image in centimetres: small under 50 cm (A3 and smaller),
 * medium from 50 cm to under 100 cm (A2 and A1), large from 100 cm.
 */
export const CATALOGUE_SIZE_BANDS = [
  { key: "small", longestSideCm: { below: 50 } },
  { key: "medium", longestSideCm: { from: 50, below: 100 } },
  { key: "large", longestSideCm: { from: 100 } },
] as const satisfies ReadonlyArray<{ key: string; longestSideCm: CatalogueBandRange }>;

export type CatalogueSizeBandKey = (typeof CATALOGUE_SIZE_BANDS)[number]["key"];

export const CATALOGUE_PRICE_BAND_KEYS: readonly CataloguePriceBandKey[] =
  CATALOGUE_PRICE_BANDS.map((band) => band.key);

export const CATALOGUE_SIZE_BAND_KEYS: readonly CatalogueSizeBandKey[] = CATALOGUE_SIZE_BANDS.map(
  (band) => band.key,
);

export function isInCatalogueBand(value: number, range: CatalogueBandRange): boolean {
  return (
    (range.from === undefined || value >= range.from) &&
    (range.below === undefined || value < range.below)
  );
}

export function isCataloguePriceBandKey(value: string): value is CataloguePriceBandKey {
  return (CATALOGUE_PRICE_BAND_KEYS as readonly string[]).includes(value);
}

export function isCatalogueSizeBandKey(value: string): value is CatalogueSizeBandKey {
  return (CATALOGUE_SIZE_BAND_KEYS as readonly string[]).includes(value);
}

export function cataloguePriceBandRange(key: CataloguePriceBandKey): CatalogueBandRange {
  return CATALOGUE_PRICE_BANDS.find((band) => band.key === key)?.pence ?? {};
}

export function catalogueSizeBandRange(key: CatalogueSizeBandKey): CatalogueBandRange {
  return CATALOGUE_SIZE_BANDS.find((band) => band.key === key)?.longestSideCm ?? {};
}

/** The band a price falls in; null without a price. */
export function cataloguePriceBandFor(pricePence: number | null): CataloguePriceBandKey | null {
  if (pricePence === null) return null;
  return (
    CATALOGUE_PRICE_BANDS.find((band) => isInCatalogueBand(pricePence, band.pence))?.key ?? null
  );
}

/** A work's size by its longest side; null unless both height and width are known. */
export function catalogueSizeBandFor(input: {
  heightCm: number | null;
  widthCm: number | null;
}): CatalogueSizeBandKey | null {
  const { heightCm, widthCm } = input;
  if (heightCm == null || widthCm == null || heightCm <= 0 || widthCm <= 0) return null;
  const longest = Math.max(heightCm, widthCm);
  return (
    CATALOGUE_SIZE_BANDS.find((band) => isInCatalogueBand(longest, band.longestSideCm))?.key ?? null
  );
}
