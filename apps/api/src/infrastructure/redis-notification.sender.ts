import type { Auction, Bid } from "@auction/types";
import type { Redis } from "ioredis";
import type {
  BidPlacedRealtimeMeta,
  IAuctionNotificationSender,
  IBidNotificationSender,
} from "../services/interfaces/notifications.js";

export class RedisNotificationSender implements IBidNotificationSender, IAuctionNotificationSender {
  constructor(private readonly redis: Redis) {}

  async notifyBidPlaced(auction: Auction, bid: Bid, meta?: BidPlacedRealtimeMeta): Promise<void> {
    const channel = `auction:${auction.id}:events`;
    await this.redis.publish(
      channel,
      JSON.stringify({
        type: "bid_placed",
        auctionId: auction.id,
        bid,
        currentPrice: auction.currentPrice,
        ...(meta?.outbidUserId ? { outbidUserId: meta.outbidUserId } : {}),
      }),
    );
  }

  async notifyAuctionExtended(auction: Auction, newEndTime: Date): Promise<void> {
    const channel = `auction:${auction.id}:events`;
    await this.redis.publish(
      channel,
      JSON.stringify({
        type: "auction_extended",
        auctionId: auction.id,
        newEndTime: newEndTime.toISOString(),
      }),
    );
  }

  async notifyAuctionEnded(auction: Auction, bid: Bid): Promise<void> {
    const channel = `auction:${auction.id}:events`;
    await this.redis.publish(
      channel,
      JSON.stringify({
        type: "auction_ended",
        auctionId: auction.id,
        winnerId: bid.bidderId,
        bidId: bid.id,
        currentPrice: bid.amount,
        status: "ended",
      }),
    );
  }
}
