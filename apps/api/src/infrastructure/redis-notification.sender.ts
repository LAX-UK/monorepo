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
    await this.redis.publish(
      channel,
      JSON.stringify({
        type: "bid_placed",
        lotId: lot.id,
        bid,
        currentPrice: lot.currentPrice,
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

  async notifyLotEnded(lot: Lot, bid: Bid): Promise<void> {
    const channel = `lot:${lot.id}:events`;
    await this.redis.publish(
      channel,
      JSON.stringify({
        type: "lot_ended",
        lotId: lot.id,
        winnerId: bid.bidderId,
        bidId: bid.id,
        currentPrice: bid.amount,
        status: "ended",
      }),
    );
  }
}
