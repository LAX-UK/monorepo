import {
  FRAMING_PRICE_MAX_PENCE,
  type FramingBandCode,
  type FramingPrices,
  type FramingStatus,
  framingBandForSheet,
} from "./framing.js";

/**
 * Framing on an edition: how the edition is sold (unframed with framing to choose, framed only, or
 * framed by the artist), which catalogue options it offers, an optional price for the edition in
 * place of the catalogue price, and what a buyer is shown. Prices are worked out here, on the
 * server side only; a buyer's choice is just an option id.
 */

export const FRAMING_MODES = ["unframed_or_framed", "framed_only", "framed_by_artist"] as const;
export type FramingMode = (typeof FRAMING_MODES)[number];

export const FRAMING_MODE_LABELS: Record<FramingMode, string> = {
  unframed_or_framed: "Unframed, with framing to choose",
  framed_only: "Framed only",
  framed_by_artist: "Comes framed by the artist",
};

export const FRAMED_BY_ARTIST_MAX_LENGTH = 500;

/**
 * The sheet size staff typed ("50 × 70 cm", "50x70cm", "50 by 70 cm"), in centimetres; null when
 * it is not two numbers in centimetres, which means framing cannot be priced for it.
 */
export function parseSheetSizeCm(
  text: string | null | undefined,
): { widthCm: number; heightCm: number } | null {
  if (!text) return null;
  const match = text
    .trim()
    .toLowerCase()
    .match(
      /^(\d+(?:[.,]\d+)?)\s*(?:×|x|by)\s*(\d+(?:[.,]\d+)?)\s*(?:cm|centimetres?|centimeters?)?$/,
    );
  if (!match?.[1] || !match[2]) return null;
  const widthCm = Number(match[1].replace(",", "."));
  const heightCm = Number(match[2].replace(",", "."));
  return widthCm > 0 && heightCm > 0 ? { widthCm, heightCm } : null;
}

/** The band an edition's sheet falls in; null when its size is unknown or larger than every band. */
export function framingBandForSheetText(text: string | null | undefined): FramingBandCode | null {
  const size = parseSheetSizeCm(text);
  return size ? framingBandForSheet(size.widthCm, size.heightCm) : null;
}

/** What the catalogue holds about an option, as far as offering it goes. */
export type FramingOptionFacts = {
  status: FramingStatus;
  /** Bands whose price is still the launch placeholder. */
  placeholderBands: readonly FramingBandCode[];
};

/** Buyers see an option only while it is offered and every one of its prices is the framer's own. */
export function isBuyerOffered(option: FramingOptionFacts): boolean {
  return option.status === "active" && option.placeholderBands.length === 0;
}

/** The price of an option on an edition, in pence including VAT: its own price, else the catalogue's. */
export function editionOptionPricePence(input: {
  catalogue: FramingPrices;
  band: FramingBandCode;
  overridePence: number | null;
}): number {
  return input.overridePence ?? input.catalogue[input.band];
}

export type EditionFramingIssueReason =
  | "framed_only_needs_option"
  | "description_required"
  | "description_too_long"
  | "offers_not_allowed"
  | "no_size_band"
  | "option_not_offerable"
  | "option_listed_twice"
  | "override_invalid";

export type EditionFramingIssue =
  | { field: "offers"; reason: EditionFramingIssueReason }
  | { field: "framedByArtist"; reason: EditionFramingIssueReason }
  | { field: `option:${string}`; reason: EditionFramingIssueReason };

export type EditionFramingInput = {
  mode: FramingMode;
  /** The artist's frame in words; only for "comes framed by the artist". */
  framedByArtist: string;
  offers: readonly { optionId: string; overridePence: number | null }[];
};

/**
 * Everything wrong with saving an edition's framing. A new offer must be an option buyers can
 * see; an offer already saved may stay while its option is paused or waiting for prices, since the
 * buyer is never shown it then. `band` is null when the sheet size is unknown or too large.
 */
export function editionFramingIssues(
  input: EditionFramingInput,
  context: {
    band: FramingBandCode | null;
    options: ReadonlyMap<string, FramingOptionFacts>;
    savedOptionIds: ReadonlySet<string>;
  },
): EditionFramingIssue[] {
  const issues: EditionFramingIssue[] = [];
  const { mode, offers } = input;

  if (mode === "framed_by_artist") {
    const text = input.framedByArtist.trim();
    if (text.length === 0) issues.push({ field: "framedByArtist", reason: "description_required" });
    else if (text.length > FRAMED_BY_ARTIST_MAX_LENGTH) {
      issues.push({ field: "framedByArtist", reason: "description_too_long" });
    }
    if (offers.length > 0) issues.push({ field: "offers", reason: "offers_not_allowed" });
    return issues;
  }

  if (offers.length > 0 && context.band === null) {
    issues.push({ field: "offers", reason: "no_size_band" });
  }

  const seen = new Set<string>();
  let offerable = 0;
  for (const offer of offers) {
    const field = `option:${offer.optionId}` as const;
    if (seen.has(offer.optionId)) {
      issues.push({ field, reason: "option_listed_twice" });
      continue;
    }
    seen.add(offer.optionId);
    const option = context.options.get(offer.optionId);
    const visibleNow = option !== undefined && isBuyerOffered(option);
    if (visibleNow) offerable += 1;
    if (!visibleNow && !context.savedOptionIds.has(offer.optionId)) {
      issues.push({ field, reason: "option_not_offerable" });
    }
    if (
      offer.overridePence !== null &&
      (!Number.isInteger(offer.overridePence) ||
        offer.overridePence < 1 ||
        offer.overridePence > FRAMING_PRICE_MAX_PENCE)
    ) {
      issues.push({ field, reason: "override_invalid" });
    }
  }

  if (mode === "framed_only" && offerable === 0) {
    issues.push({ field: "offers", reason: "framed_only_needs_option" });
  }
  return issues;
}

/** Working days a framed order adds to the delivery or collection dates shown: both ends of the range. */
export type FramingLeadWindow = { minDays: number; maxDays: number };

/**
 * The days to add for a chosen option; none for an unframed print. The range is added to both
 * ends of the delivery window, so "11 to 13 Nov" becomes the earliest plus the shortest framing
 * to the latest plus the longest.
 */
export function framingLeadWindow(
  option: { leadTimeMinDays: number; leadTimeMaxDays: number } | null,
): FramingLeadWindow {
  return option
    ? { minDays: option.leadTimeMinDays, maxDays: option.leadTimeMaxDays }
    : { minDays: 0, maxDays: 0 };
}

/** What a buyer can do about framing on an edition, from the offers that are visible to them. */
export type BuyerFramingChoice =
  | { kind: "none" }
  | { kind: "framed_by_artist"; description: string }
  | { kind: "choose"; required: boolean; optionIds: readonly string[] }
  | { kind: "unavailable" };

/**
 * The framing group a buyer sees. Nothing for an edition with no visible options, so its page
 * looks as it did before; "framed only" with no visible option cannot be bought right now.
 */
export function buyerFramingChoice(input: {
  mode: FramingMode;
  framedByArtist: string;
  visibleOptionIds: readonly string[];
}): BuyerFramingChoice {
  if (input.mode === "framed_by_artist") {
    const description = input.framedByArtist.trim();
    return description ? { kind: "framed_by_artist", description } : { kind: "none" };
  }
  if (input.mode === "framed_only") {
    return input.visibleOptionIds.length > 0
      ? { kind: "choose", required: true, optionIds: input.visibleOptionIds }
      : { kind: "unavailable" };
  }
  return input.visibleOptionIds.length > 0
    ? { kind: "choose", required: false, optionIds: input.visibleOptionIds }
    : { kind: "none" };
}
