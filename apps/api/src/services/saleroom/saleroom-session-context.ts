import type { ISaleroomSessionRepository } from "@auction/persistence";
import type { Redis } from "ioredis";
import type { ILotJobScheduler } from "../interfaces/job-scheduler.js";
import type { ILotRepository, ISaleRepository } from "../interfaces/repositories.js";
import type { ISaleroomRealtimePublisher } from "../interfaces/saleroom-realtime-publisher.js";
import type { ITelephoneBidBookingSaleroomBridge } from "../interfaces/telephone-bid-booking-service.js";
import type { LotLifecycleService } from "../lot-lifecycle.service.js";

export const SALEROOM_CHANNEL = (saleId: string) => `sale:${saleId}:saleroom`;

export type SaleroomSessionContext = {
  sessionRepo: ISaleroomSessionRepository;
  redis: Redis;
  lotLifecycle: LotLifecycleService;
  saleRepo: ISaleRepository;
  lotRepo: ILotRepository;
  lotJobs: ILotJobScheduler | null;
  telephoneBidBookingService: ITelephoneBidBookingSaleroomBridge | null;
  displayPublisher: ISaleroomRealtimePublisher | null;
};

export function createSaleroomSessionContext(
  input: SaleroomSessionContext,
): SaleroomSessionContext {
  return input;
}

export async function publishSaleroomEvent(
  redis: Redis,
  saleId: string,
  body: Record<string, unknown>,
): Promise<void> {
  await redis.publish(
    SALEROOM_CHANNEL(saleId),
    JSON.stringify({ ...body, saleId, emittedAt: new Date().toISOString() }),
  );
}
