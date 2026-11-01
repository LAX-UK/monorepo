import {
  type BuyersPremiumTerms,
  buyersPremiumTerms,
  nextBidAmount,
  validBidAmounts,
} from "@auction/domain";
import type { Lot, PublicLotView, Sale } from "@auction/types";

/**
 * What a lot page needs to bid and to read a result without recomputing server rules:
 * the next valid amounts, the buyer's premium terms and, once a lot has sold, the public price.
 * Timing is on the lot itself; `serverNow` is the clock the countdown is measured against.
 */
export type LotDetailBiddingView = {
  /** The server clock when the response was made, so the page can correct for a skewed device. */
  serverNow: string;
  /** The close a late bid moved the lot to, or `null` while it keeps its scheduled end. */
  extendedUntil: string | null;
  /** The next valid bid; `null` once bidding can no longer happen. */
  nextBidAmount: string | null;
  /** The next valid amounts, lowest first: the choices for a maximum bid. */
  validBidAmounts: string[];
  buyersPremium: BuyersPremiumTerms;
  /** On an ended sold lot: the hammer price. */
  hammerPrice: string | null;
  /** On an ended sold lot: the hammer plus the buyer's premium. */
  soldForWithPremium: string | null;
};

const BIDDABLE: ReadonlySet<Lot["status"]> = new Set(["scheduled", "active"]);

function lotSold(lot: Pick<Lot, "status" | "winnerId" | "hasWinner" | "atgSold">): boolean {
  return (
    lot.status === "ended" &&
    (lot.winnerId != null || lot.hasWinner === true || lot.atgSold === true)
  );
}

/** Pure: the lot is already masked for the viewer (a sealed lot's real price is never read here). */
export function buildLotDetailBiddingView(input: {
  lot: Lot | PublicLotView;
  sale: Pick<Sale, "buyerPremiumTiers"> | null;
  checkoutTotal: string;
  now: Date;
}): LotDetailBiddingView {
  const { lot, sale } = input;
  const biddable = BIDDABLE.has(lot.status);
  const sold = lotSold(lot);
  return {
    serverNow: input.now.toISOString(),
    extendedUntil: lot.extendedUntil ? new Date(lot.extendedUntil).toISOString() : null,
    nextBidAmount: biddable ? nextBidAmount(lot) : null,
    validBidAmounts: biddable ? validBidAmounts(lot) : [],
    buyersPremium: buyersPremiumTerms({
      lotRate: lot.buyerPremiumRate,
      bands: sale?.buyerPremiumTiers ?? null,
    }),
    hammerPrice: sold ? lot.currentPrice : null,
    soldForWithPremium: sold ? input.checkoutTotal : null,
  };
}
