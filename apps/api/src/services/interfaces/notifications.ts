import type { Bid, Lot } from "@auction/types";

export type BidPlacedRealtimeMeta = {
  /** Previous high bidder (for client-side outbid toast). */
  outbidUserId?: string | undefined;
};

/** ISP: bid-related realtime / outbound notifications only. */
export interface IBidNotificationSender {
  notifyBidPlaced(lot: Lot, bid: Bid, meta?: BidPlacedRealtimeMeta): Promise<void>;
}

/** ISP: lot lifecycle notifications (extensions, etc.). */
export interface ILotNotificationSender {
  notifyLotExtended(lot: Lot, newEndTime: Date): Promise<void>;
  notifyLotEnded(lot: Lot, bid: Bid): Promise<void>;
}
