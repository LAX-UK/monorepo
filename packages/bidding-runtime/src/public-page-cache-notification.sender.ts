import { publicPageTagsForLot } from "@auction/domain";
import type { Bid, Lot } from "@auction/types";
import type { BidPlacedRealtimeMeta, INotificationSender, LotEndedRealtimeMeta } from "./ports.js";

/** `WebPublicCacheInvalidator` from `@auction/background-runtime`, by shape. */
export type PublicPageCacheInvalidator = {
  invalidate(tags: readonly string[]): Promise<void>;
};

/**
 * Wraps the realtime sender: after a bid is accepted, a close time moves or a lot ends (the
 * changes that have no domain event of their own), the web app is asked to drop the cached public
 * reads of that lot and its sale. The purge is never awaited by bidding and a failure is only
 * logged: the live bid state reaches the page through the socket and a no-store read, never the
 * cached HTML, so a missed purge only leaves a card price or a status line old until it expires.
 */
export class PublicPageCacheNotificationSender implements INotificationSender {
  constructor(
    private readonly inner: INotificationSender,
    private readonly invalidator: PublicPageCacheInvalidator,
    private readonly onError: (err: unknown, lotId: string) => void,
  ) {}

  private purge(lot: Pick<Lot, "id" | "saleId">): void {
    this.invalidator
      .invalidate(publicPageTagsForLot({ id: lot.id, saleId: lot.saleId ?? null }))
      .catch((err: unknown) => this.onError(err, lot.id));
  }

  async notifyBidPlaced(lot: Lot, bid: Bid, meta?: BidPlacedRealtimeMeta): Promise<void> {
    try {
      await this.inner.notifyBidPlaced(lot, bid, meta);
    } finally {
      this.purge(lot);
    }
  }

  async notifyLotExtended(lot: Lot, newEndTime: Date): Promise<void> {
    try {
      await this.inner.notifyLotExtended(lot, newEndTime);
    } finally {
      this.purge(lot);
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
      this.purge(lot);
    }
  }

  /** A cancelled proxy changes nothing a visitor sees. */
  notifyProxyCancelled(lotId: string, bidderUserId: string, reason?: string): Promise<void> {
    return this.inner.notifyProxyCancelled(lotId, bidderUserId, reason);
  }
}
