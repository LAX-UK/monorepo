import type { SaleroomDisplayControlPayload } from "@auction/types";
import type { Redis } from "ioredis";
import type { ISaleroomRealtimePublisher } from "../services/interfaces/saleroom-realtime-publisher.js";

const DISPLAY_CHANNEL = (saleId: string) => `sale:${saleId}:display`;

export class RedisSaleroomRealtimePublisher implements ISaleroomRealtimePublisher {
  constructor(private readonly redis: Redis) {}

  async publishDisplayControl(
    saleId: string,
    payload: SaleroomDisplayControlPayload,
  ): Promise<void> {
    await this.redis.publish(
      DISPLAY_CHANNEL(saleId),
      JSON.stringify({ ...payload, saleId, emittedAt: payload.emittedAt }),
    );
  }
}
