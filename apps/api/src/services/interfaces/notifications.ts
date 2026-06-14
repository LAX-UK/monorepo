import type { Bid, Lot } from "@auction/types";

export type BidPlacedRealtimeMeta = {
  /** Previous high bidder (for client-side outbid toast). */
  outbidUserId?: string | undefined;
  /** Total bids on the lot after placement. */
  bidCount?: number | undefined;
};

/** ISP: bid-related realtime / outbound notifications only. */
export interface IBidNotificationSender {
  notifyBidPlaced(lot: Lot, bid: Bid, meta?: BidPlacedRealtimeMeta): Promise<void>;
}

/** ISP: lot lifecycle notifications (extensions, etc.). */
export interface ILotNotificationSender {
  notifyLotExtended(lot: Lot, newEndTime: Date): Promise<void>;
  /** Pass `null` when the lot ends with no winning bid (e.g. clerk no-sale). */
  notifyLotEnded(lot: Lot, winningBid: Bid | null): Promise<void>;
  notifyProxyCancelled(lotId: string, bidderUserId: string, reason?: string): Promise<void>;
}
