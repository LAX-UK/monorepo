import type { Bid, Lot } from "@auction/types";
import type { Redis } from "ioredis";
import type {
  BidPlacedRealtimeMeta,
  IBidNotificationSender,
  ILotNotificationSender,
} from "../services/interfaces/notifications.js";

export class RedisNotificationSender implements IBidNotificationSender, ILotNotificationSender {
  constructor(private readonly redis: Redis) {}

  async notifyBidPlaced(lot: Lot, bid: Bid, meta?: BidPlacedRealtimeMeta): Promise<void> {
    const channel = `lot:${lot.id}:events`;
    if (lot.auctionType === "sealed" && lot.status === "active") {
      await this.redis.publish(
        channel,
        JSON.stringify({
          type: "bid_placed",
          lotId: lot.id,
          sealed: true,
        }),
      );
      return;
    }
    await this.redis.publish(
      channel,
      JSON.stringify({
        type: "bid_placed",
        lotId: lot.id,
        bid,
        currentPrice: lot.currentPrice,
        emittedAt: Date.now(),
        ...(meta?.outbidUserId ? { outbidUserId: meta.outbidUserId } : {}),
      }),
    );
  }

  async notifyLotExtended(lot: Lot, newEndTime: Date): Promise<void> {
    const channel = `lot:${lot.id}:events`;
    await this.redis.publish(
      channel,
      JSON.stringify({
        type: "lot_extended",
        lotId: lot.id,
        newEndTime: newEndTime.toISOString(),
      }),
    );
  }

  async notifyProxyCancelled(lotId: string, bidderUserId: string, reason?: string): Promise<void> {
    const channel = `lot:${lotId}:events`;
    await this.redis.publish(
      channel,
      JSON.stringify({
        type: "proxy_cancelled",
        lotId,
        bidderUserId,
        ...(reason ? { reason } : {}),
      }),
    );
  }

  async notifyLotEnded(lot: Lot, winningBid: Bid | null): Promise<void> {
    const channel = `lot:${lot.id}:events`;
    const winnerId = winningBid?.placedByUserId ?? winningBid?.bidderId ?? null;
    await this.redis.publish(
      channel,
      JSON.stringify({
        type: "lot_ended",
        lotId: lot.id,
        winnerId,
        bidId: winningBid?.id ?? null,
        currentPrice: winningBid?.amount ?? lot.currentPrice,
        status: "ended",
        ...(winnerId ? {} : { noSale: true }),
      }),
    );
  }
}
