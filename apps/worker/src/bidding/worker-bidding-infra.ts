import type {
  BidPlacedRealtimeMeta,
  ICacheProvider,
  IIdempotencyStore,
  INotificationSender,
  LotEndedRealtimeMeta,
} from "@auction/bidding-runtime";
import { IDEMPOTENCY_PENDING_VALUE } from "@auction/bidding-runtime";
import { deriveNoSaleReason, deriveReserveStatus } from "@auction/domain";
import type { Bid, Lot, LotEndedTrigger } from "@auction/types";
import {
  encodeBidPlacedPublicRedisMessage,
  encodeBidPlacedSealedRedisMessage,
  encodeLotExtendedRedisMessage,
  encodeProxyCancelledRedisMessage,
} from "@auction/validators";
import type { Redis } from "ioredis";

export class WorkerRedisCacheProvider implements ICacheProvider {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.redis.set(key, value, "EX", ttlSeconds);
      return;
    }
    await this.redis.set(key, value);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

export class WorkerRedisIdempotencyStore implements IIdempotencyStore {
  constructor(private readonly redis: Redis) {}

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, "EX", ttlSeconds);
  }

  async tryClaim(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(key, IDEMPOTENCY_PENDING_VALUE, "EX", ttlSeconds, "NX");
    return result === "OK";
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

export class WorkerRedisBidNotificationSender implements INotificationSender {
  constructor(private readonly redis: Redis) {}

  async notifyBidPlaced(lot: Lot, bid: Bid, meta?: BidPlacedRealtimeMeta): Promise<void> {
    const channel = `lot:${lot.id}:events`;
    if (lot.auctionType === "sealed" && lot.status === "active") {
      await this.redis.publish(channel, encodeBidPlacedSealedRedisMessage(lot.id));
      return;
    }
    const reserveStatus = deriveReserveStatus(lot.currentPrice, lot.reservePrice);
    const reserveMet = reserveStatus.kind === "none" ? undefined : reserveStatus.kind === "met";
    await this.redis.publish(
      channel,
      encodeBidPlacedPublicRedisMessage({
        lotId: lot.id,
        bid,
        currentPrice: lot.currentPrice,
        emittedAt: Date.now(),
        ...(meta?.outbidUserId ? { outbidUserId: meta.outbidUserId } : {}),
        ...(meta?.bidCount != null ? { bidCount: meta.bidCount } : {}),
        ...(reserveMet !== undefined ? { reserveMet } : {}),
      }),
    );
  }

  async notifyLotExtended(lot: Lot, newEndTime: Date): Promise<void> {
    const channel = `lot:${lot.id}:events`;
    await this.redis.publish(
      channel,
      encodeLotExtendedRedisMessage({
        lotId: lot.id,
        newEndTime: newEndTime.toISOString(),
      }),
    );
  }

  async notifyProxyCancelled(lotId: string, bidderUserId: string, reason?: string): Promise<void> {
    const channel = `lot:${lotId}:events`;
    await this.redis.publish(
      channel,
      encodeProxyCancelledRedisMessage({
        lotId,
        bidderUserId,
        ...(reason ? { reason } : {}),
      }),
    );
  }

  async notifyLotEnded(
    lot: Lot,
    winningBid: Bid | null,
    meta?: LotEndedRealtimeMeta,
  ): Promise<void> {
    const channel = `lot:${lot.id}:events`;
    const winnerId = winningBid?.placedByUserId ?? winningBid?.bidderId ?? null;
    const hammerPrice = winningBid?.amount ?? lot.currentPrice;
    const reserveStatus = deriveReserveStatus(hammerPrice, lot.reservePrice);
    const sold = Boolean(winnerId);
    const hadBids = meta?.hadBids ?? sold;
    let noSaleReason: ReturnType<typeof deriveNoSaleReason> | undefined;
    if (!sold) {
      const input: {
        reserveStatus: ReturnType<typeof deriveReserveStatus>;
        hadBids: boolean;
        trigger?: LotEndedTrigger;
        voided?: boolean;
      } = { reserveStatus, hadBids };
      if (meta?.trigger) input.trigger = meta.trigger;
      if (meta?.voided) input.voided = true;
      noSaleReason = deriveNoSaleReason(input);
    }
    const reserveMet = reserveStatus.kind === "none" ? undefined : reserveStatus.kind === "met";

    await this.redis.publish(
      channel,
      JSON.stringify({
        type: "lot_ended",
        lotId: lot.id,
        winnerId,
        bidId: winningBid?.id ?? null,
        currentPrice: hammerPrice,
        status: "ended",
        outcome: sold ? "sold" : "no_sale",
        ...(sold ? {} : { noSale: true }),
        ...(noSaleReason && noSaleReason !== "voided" ? { noSaleReason } : {}),
        ...(reserveMet !== undefined ? { reserveMet } : {}),
        hadBids,
        ...(meta?.trigger ? { trigger: meta.trigger } : {}),
      }),
    );
  }
}
