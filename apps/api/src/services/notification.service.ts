import type { Bid, Lot } from "@auction/types";
import type {
  BidPlacedRealtimeMeta,
  IBidNotificationSender,
  ILotNotificationSender,
} from "./interfaces/notifications.js";

/**
 * Application-level notifications — delegates to segregated senders (ISP).
 */
export class NotificationService {
  constructor(
    private readonly bidSender: IBidNotificationSender,
    private readonly lotSender: ILotNotificationSender,
  ) {}

  notifyBidPlaced(lot: Lot, bid: Bid, meta?: BidPlacedRealtimeMeta): Promise<void> {
    return this.bidSender.notifyBidPlaced(lot, bid, meta);
  }

  notifyLotExtended(lot: Lot, newEndTime: Date): Promise<void> {
    return this.lotSender.notifyLotExtended(lot, newEndTime);
  }

  notifyLotEnded(lot: Lot, bid: Bid): Promise<void> {
    return this.lotSender.notifyLotEnded(lot, bid);
  }
}
