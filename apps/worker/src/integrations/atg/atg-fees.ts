import type { GapAuctionTypeAndListing } from "./gap-types.js";

/**
 * The charges ATG adds on top of the hammer price for auctions it hosts. ATG sets these, not LAX,
 * so they can differ from LAX's own charges on lax.bid. Every rate here is a percentage (VAT
 * of 20 is 20% of the charge it applies to); the mapper converts VAT to GAP's multiplier.
 */
export type AtgAuctionFees = {
  buyersPremiumVatRate: number;
  /** ATG's commission passed to the bidder, per auction type; null when ATG has not given one. */
  internetSurchargeRate: Readonly<Record<GapAuctionTypeAndListing, number | null>>;
  internetSurchargeVatRate: number;
};

/**
 * The same rates are written out for people in docs/integrations/atg.md,
 * docs/runbooks/atg-manual-settlement.md and the LAX Bid terms (§11); update them together.
 *
 * Confirmed by ATG Seller Support (Nov 2026): buyer's premium plus VAT on it, and a 3% internet
 * surcharge for timed auctions plus VAT on it. ATG has not given a live-auction surcharge yet.
 */
export const ATG_AUCTION_FEES: AtgAuctionFees = {
  buyersPremiumVatRate: 20,
  internetSurchargeRate: { Timed: 3, Live: null },
  internetSurchargeVatRate: 20,
};
