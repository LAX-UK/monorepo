import type { FramingMode } from "./framing-edition.js";

/**
 * The Orientation and Framing groups the Shop catalogue filters and counts by. Like the price and
 * size bands (`catalogue-bands.ts`), one set of rules serves shop-api (the SQL filters and the
 * facet counts, built from the constants here) and the storefront (the rail and its links), so an
 * option always means the same works on both sides.
 */

/**
 * How far the longer side may exceed the shorter, in percent, for a work to still count as
 * square. 5 % keeps a 50 × 52 cm sheet square and makes a 50 × 53 cm one portrait.
 */
export const CATALOGUE_SQUARE_TOLERANCE_PERCENT = 5;

export const CATALOGUE_ORIENTATION_KEYS = ["portrait", "landscape", "square"] as const;

export type CatalogueOrientationKey = (typeof CATALOGUE_ORIENTATION_KEYS)[number];

export function isCatalogueOrientationKey(value: string): value is CatalogueOrientationKey {
  return (CATALOGUE_ORIENTATION_KEYS as readonly string[]).includes(value);
}

/** Centimetres held to two decimals, as `shop_artwork` stores them, as whole hundredths. */
function hundredths(cm: number): number {
  return Math.round(cm * 100);
}

/**
 * A work's orientation from its image size: portrait when the height is more than 5 % greater
 * than the width, landscape when the width is more than 5 % greater than the height, square
 * otherwise. Null unless both height and width are known, so such works are left out of the
 * group, as they are of Size. Compared in whole hundredths of a centimetre so the result matches
 * the database's exact numeric comparison.
 */
export function catalogueOrientationFor(input: {
  heightCm: number | null;
  widthCm: number | null;
}): CatalogueOrientationKey | null {
  const { heightCm, widthCm } = input;
  if (heightCm == null || widthCm == null || heightCm <= 0 || widthCm <= 0) return null;
  const height = hundredths(heightCm);
  const width = hundredths(widthCm);
  const ratio = 100 + CATALOGUE_SQUARE_TOLERANCE_PERCENT;
  if (height * 100 > width * ratio) return "portrait";
  if (width * 100 > height * ratio) return "landscape";
  return "square";
}

export const CATALOGUE_FRAMING_KEYS = ["framed", "unframed"] as const;

export type CatalogueFramingKey = (typeof CATALOGUE_FRAMING_KEYS)[number];

export function isCatalogueFramingKey(value: string): value is CatalogueFramingKey {
  return (CATALOGUE_FRAMING_KEYS as readonly string[]).includes(value);
}

export type CatalogueFramingRule = {
  /** An edition with no framing row (sold unframed only) is in the group. */
  withoutFramingRow: boolean;
  /** Modes that put an edition in the group on their own. */
  modes: readonly FramingMode[];
  /** Modes that put an edition in the group only while it offers a framing option buyers see. */
  modesWithOfferedOption: readonly FramingMode[];
};

/**
 * Which editions each framing option holds. "Available framed": comes framed by the artist, or
 * framed only or framing to choose with at least one option buyers can see (active, with every
 * price the framer's: `isBuyerOffered`). "Available unframed": no framing row, or framing to
 * choose. An edition sold unframed with framing to choose is in both, which is what shoppers
 * mean; a framed-only edition with no option offered cannot be bought and is in neither.
 */
export const CATALOGUE_FRAMING_RULES: Record<CatalogueFramingKey, CatalogueFramingRule> = {
  framed: {
    withoutFramingRow: false,
    modes: ["framed_by_artist"],
    modesWithOfferedOption: ["framed_only", "unframed_or_framed"],
  },
  unframed: {
    withoutFramingRow: true,
    modes: ["unframed_or_framed"],
    modesWithOfferedOption: [],
  },
};

export type CatalogueFramingFacts = {
  /** The edition's framing mode; null when it has no framing row. */
  mode: FramingMode | null;
  /** Whether it offers at least one framing option buyers can see. */
  hasOfferedOption: boolean;
};

export function isInCatalogueFraming(key: CatalogueFramingKey, facts: CatalogueFramingFacts) {
  const rule = CATALOGUE_FRAMING_RULES[key];
  if (facts.mode === null) return rule.withoutFramingRow;
  return (
    rule.modes.includes(facts.mode) ||
    (facts.hasOfferedOption && rule.modesWithOfferedOption.includes(facts.mode))
  );
}

/** The framing options an edition is listed under, in rail order: none, one or both. */
export function catalogueFramingFor(facts: CatalogueFramingFacts): CatalogueFramingKey[] {
  return CATALOGUE_FRAMING_KEYS.filter((key) => isInCatalogueFraming(key, facts));
}
