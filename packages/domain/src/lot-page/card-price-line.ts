import type { LotLifecycleKind, LotTimeLineKind } from "./lifecycle-copy.js";
import { lotLifecycleCopy } from "./lifecycle-copy.js";
import { type LotEstimate, type PriceBlockFormat, buildPriceBlock } from "./price-block.js";
import { NO_VIEWER_STATE } from "./viewer-state.js";

export type CardPriceLineInput = {
  lifecycle: LotLifecycleKind;
  bidCount: number;
  amounts: {
    starting: string;
    current: string;
    hammer: string | null;
    soldForWithPremium: string | null;
  };
  estimate: LotEstimate | null;
  format: PriceBlockFormat;
};

/** What a card says about the price and the clock, in the words of the lot page. */
export type CardPriceLine = {
  /** "Current bid", "Starting bid", "Sold for", "Estimate" or "Not sold". */
  label: string;
  /** The figure as the page prints it; `null` when the lot has no price to show. */
  value: string | null;
  /** Which moment the card's time part reports: when it opens, when it closes, or that it ended. */
  time: LotTimeLineKind;
};

/**
 * The price and time line of a card. It is the lot page's own headline for the same lifecycle,
 * so a card can never say "Current bid" for a lot the page calls "Sold for".
 */
export function cardPriceLine(input: CardPriceLineInput): CardPriceLine {
  const price = buildPriceBlock({
    lifecycle: input.lifecycle,
    amounts: input.amounts,
    estimate: input.estimate,
    bidCount: input.bidCount,
    reserve: "none",
    nextBid: null,
    extendedByMs: null,
    saleroom: null,
    signedIn: false,
    registrationRequired: false,
    viewer: NO_VIEWER_STATE,
    purchase: null,
    agentLimitLeft: null,
    format: input.format,
  });
  const copy = lotLifecycleCopy(input.lifecycle);
  // With no price to report (unsold, cancelled, withdrawn) the card says the outcome in the
  // badge's own word. An unsold lot's estimate is already on the card's own row.
  const noPrice = copy.headline === "result" || copy.headline === "none";
  return {
    label: noPrice ? copy.badge.label : price.label,
    value: noPrice ? null : price.amountText,
    time: copy.timeLine,
  };
}
