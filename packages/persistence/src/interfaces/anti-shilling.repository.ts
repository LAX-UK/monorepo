import type { Lot } from "@auction/types";

export type AntiShillingBidContext = {
  bidderUserId: string;
  buyerLegalEntityId: string;
  lot: Lot;
};

export interface IAntiShillingGuard {
  /** Returns true when the bidder is an active accepted member of the lot's
   * seller legal entity. This blocks self-bids through organisations and
   * shared team membership, not just legacy `sellerId === bidderId`.
   */
  bidderSharesSellerLegalEntity(bidderId: string, lot: Lot): Promise<boolean>;
  /** True when the bid must be blocked: bidder is in the seller org, buyer and
   * seller entities are the same, or the two entities share any accepted member.
   */
  violatesAntiShilling(ctx: AntiShillingBidContext): Promise<boolean>;
}
