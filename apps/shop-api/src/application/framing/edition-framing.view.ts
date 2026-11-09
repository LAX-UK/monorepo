import type { BasketLineFraming, PublicEditionFraming } from "@auction/shop-contracts";
import {
  type FramingBandCode,
  buyerFramingChoice,
  editionOptionPricePence,
  framingBandForSheetText,
  isBuyerOffered,
} from "@auction/shop-domain";
import type {
  CatalogueOptionFacts,
  EditionFramingFacts,
  EditionFramingOfferFacts,
} from "./edition-framing.ports.js";

/** An offer a buyer can see, with the price for this edition's size. */
export type VisibleFramingOffer = EditionFramingOfferFacts & { pricePence: number };

/** The edition's size band, from its catalogued sheet size; null when unknown or too large. */
export function editionBand(facts: Pick<EditionFramingFacts, "sheetSize">): FramingBandCode | null {
  return framingBandForSheetText(facts.sheetSize);
}

/**
 * The offers a buyer can see: options that are offered with every price the framer's, on an
 * edition whose size has a band. Nothing for a print that comes framed by the artist.
 */
export function visibleOffers(facts: EditionFramingFacts): VisibleFramingOffer[] {
  const band = editionBand(facts);
  if (band === null || facts.mode === "framed_by_artist") return [];
  return facts.offers
    .filter((offer) => isBuyerOffered(offer))
    .map((offer) => ({
      ...offer,
      pricePence: editionOptionPricePence({
        catalogue: offer.pricesPence,
        band,
        overridePence: offer.overridePence,
      }),
    }));
}

/** The framing group the buyer's edition page shows. */
export function presentPublicFraming(facts: EditionFramingFacts): PublicEditionFraming {
  const visible = visibleOffers(facts);
  const choice = buyerFramingChoice({
    mode: facts.mode,
    framedByArtist: facts.framedByArtist,
    visibleOptionIds: visible.map((offer) => offer.optionId),
  });
  const options = visible.map((offer) => ({
    id: offer.optionId,
    name: offer.name,
    frame: offer.frame,
    mount: offer.mount,
    glazing: offer.glazing,
    hanging: offer.hanging,
    pricePence: offer.pricePence,
    leadTimeMinDays: offer.leadTimeMinDays,
    leadTimeMaxDays: offer.leadTimeMaxDays,
  }));
  switch (choice.kind) {
    case "none":
      return { kind: "none", required: false, description: null, options: [] };
    case "unavailable":
      return { kind: "unavailable", required: true, description: null, options: [] };
    case "framed_by_artist":
      return {
        kind: "framed_by_artist",
        required: false,
        description: choice.description,
        options: [],
      };
    case "choose":
      return { kind: "choose", required: choice.required, description: null, options };
  }
}

/**
 * The framing on a basket line, described from the catalogue option so a line whose option was
 * paused, or taken off the edition, since still says what it was. `available` is false then, and
 * the shopper is asked to choose again. Priced at the edition's own price when it has one. A
 * sheet size with no band cannot be priced, so the price shown is 0 and the line is unavailable.
 */
export function presentBasketFraming(
  facts: EditionFramingFacts,
  option: CatalogueOptionFacts,
): BasketLineFraming {
  const band = editionBand(facts);
  const offer = facts.offers.find((candidate) => candidate.optionId === option.optionId);
  const visible = visibleOffers(facts).some((candidate) => candidate.optionId === option.optionId);
  return {
    optionId: option.optionId,
    name: option.name,
    frame: option.frame,
    mount: option.mount,
    glazing: option.glazing,
    hanging: option.hanging,
    pricePence:
      band === null
        ? 0
        : editionOptionPricePence({
            catalogue: option.pricesPence,
            band,
            overridePence: offer?.overridePence ?? null,
          }),
    leadTimeMinDays: option.leadTimeMinDays,
    leadTimeMaxDays: option.leadTimeMaxDays,
    available: visible,
  };
}

export type FramingChoiceProblem =
  | "choose_framing"
  | "framing_not_offered"
  | "framing_not_available";

/**
 * Whether a buyer's choice (an option id, or null for unframed) can go in the basket for this
 * edition: a framed-only edition needs an option, and an option must be one the buyer is shown.
 * Returns null when the choice is fine.
 */
export function framingChoiceProblem(
  facts: EditionFramingFacts,
  optionId: string | null,
): FramingChoiceProblem | null {
  const visible = visibleOffers(facts);
  if (optionId === null) {
    return facts.mode === "framed_only" ? "choose_framing" : null;
  }
  if (facts.mode === "framed_by_artist") return "framing_not_offered";
  if (visible.some((offer) => offer.optionId === optionId)) return null;
  return facts.offers.some((offer) => offer.optionId === optionId)
    ? "framing_not_available"
    : "framing_not_offered";
}

/** The sentences shoppers get for a refused choice. */
export const FRAMING_CHOICE_MESSAGES: Record<FramingChoiceProblem, string> = {
  choose_framing: "Choose a frame for this edition.",
  framing_not_offered: "That framing is not offered for this edition.",
  framing_not_available: "That framing is not available right now.",
};
