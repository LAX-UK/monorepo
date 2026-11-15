import { publicPageTagsForBid, publicPageTagsForLot } from "@auction/domain";
import type { Bid, Lot } from "@auction/types";
import type { BidPlacedRealtimeMeta, INotificationSender, LotEndedRealtimeMeta } from "./ports.js";

/** `WebPublicCacheInvalidator` from `@auction/background-runtime`, by shape. */
export type PublicPageCacheInvalidator = {
  invalidate(tags: readonly string[]): Promise<void>;
};

/**
 * Wraps the realtime sender: after a bid is accepted, a close time moves or a lot ends (the
 * changes that have no domain event of their own), the web app is asked to drop cached public
 * reads. A bid or an extension drops the lot alone: its price, close time and history are never
 * drawn from the cache (the lot page and the catalogue cards read them live), so nothing on the
 * sale's pages changes, and a busy sale's catalogue is not emptied by every bid. A lot's end also
 * drops its sale, whose catalogue lists and filters it by status (sold, unsold, ended). The purge
 * is never awaited by bidding and a failure is only logged.
 */
export class PublicPageCacheNotificationSender implements INotificationSender {
  constructor(
    private readonly inner: INotificationSender,
    private readonly invalidator: PublicPageCacheInvalidator,
    private readonly onError: (err: unknown, lotId: string) => void,
  ) {}

  private purge(lotId: string, tags: readonly string[]): void {
    this.invalidator.invalidate(tags).catch((err: unknown) => this.onError(err, lotId));
  }

  async notifyBidPlaced(lot: Lot, bid: Bid, meta?: BidPlacedRealtimeMeta): Promise<void> {
    try {
      await this.inner.notifyBidPlaced(lot, bid, meta);
    } finally {
      this.purge(lot.id, publicPageTagsForBid(lot));
    }
  }

  async notifyLotExtended(lot: Lot, newEndTime: Date): Promise<void> {
    try {
      await this.inner.notifyLotExtended(lot, newEndTime);
    } finally {
      this.purge(lot.id, publicPageTagsForBid(lot));
    }
  }

  async notifyLotEnded(
    lot: Lot,
    winningBid: Bid | null,
    meta?: LotEndedRealtimeMeta,
  ): Promise<void> {
    try {
      await this.inner.notifyLotEnded(lot, winningBid, meta);
    } finally {
      this.purge(lot.id, publicPageTagsForLot({ id: lot.id, saleId: lot.saleId ?? null }));
    }
  }

  /** A cancelled proxy changes nothing a visitor sees. */
  notifyProxyCancelled(lotId: string, bidderUserId: string, reason?: string): Promise<void> {
    return this.inner.notifyProxyCancelled(lotId, bidderUserId, reason);
  }
}
