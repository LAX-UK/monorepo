import type { Redis } from "ioredis";
import type { ISaleroomSessionRepository } from "../repositories/interfaces/saleroom-session.repository.js";
import type { ILotJobScheduler } from "./interfaces/job-scheduler.js";
import type { ILotRepository, ISaleRepository } from "./interfaces/repositories.js";
import type { ISaleroomRealtimePublisher } from "./interfaces/saleroom-realtime-publisher.js";
import type { ISaleroomService, SaleroomSessionStatusRow } from "./interfaces/saleroom-service.js";
import type { ITelephoneBidBookingSaleroomBridge } from "./interfaces/telephone-bid-booking-service.js";
import type { LotLifecycleService } from "./lot-lifecycle.service.js";
import { SaleroomDisplayControlService } from "./saleroom/saleroom-display-control.service.js";
import { createSaleroomSessionContext } from "./saleroom/saleroom-session-context.js";
import { SaleroomSessionControlService } from "./saleroom/saleroom-session-control.service.js";
import { SaleroomSessionReadService } from "./saleroom/saleroom-session-read.service.js";

export type { SaleroomServiceError } from "./interfaces/saleroom-service.js";
export { SALEROOM_CHANNEL } from "./saleroom/saleroom-session-context.js";

export type SaleroomServiceOptions = {
  sessionRepo: ISaleroomSessionRepository;
  redis: Redis;
  lotLifecycle: LotLifecycleService;
  saleRepo: ISaleRepository;
  lotRepo: ILotRepository;
  lotJobs: ILotJobScheduler | null;
  telephoneBidBookingService?: ITelephoneBidBookingSaleroomBridge | null;
  displayPublisher?: ISaleroomRealtimePublisher | null;
};

export class SaleroomService implements ISaleroomService {
  private readonly read: SaleroomSessionReadService;
  private readonly control: SaleroomSessionControlService;
  private readonly display: SaleroomDisplayControlService;

  constructor(opts: SaleroomServiceOptions) {
    const ctx = createSaleroomSessionContext({
      sessionRepo: opts.sessionRepo,
      redis: opts.redis,
      lotLifecycle: opts.lotLifecycle,
      saleRepo: opts.saleRepo,
      lotRepo: opts.lotRepo,
      lotJobs: opts.lotJobs,
      telephoneBidBookingService: opts.telephoneBidBookingService ?? null,
      displayPublisher: opts.displayPublisher ?? null,
    });
    this.read = new SaleroomSessionReadService(ctx);
    this.display = new SaleroomDisplayControlService(ctx);
    this.control = new SaleroomSessionControlService(ctx, this.display);
  }

  getPublicSessionStatus(saleId: string) {
    return this.read.getPublicSessionStatus(saleId);
  }

  getSessionStatuses(saleIds: readonly string[]): Promise<SaleroomSessionStatusRow[]> {
    return this.read.getSessionStatuses(saleIds);
  }

  getSessionWithRecentEvents(saleId: string) {
    return this.read.getSessionWithRecentEvents(saleId);
  }

  goLive(input: Parameters<ISaleroomService["goLive"]>[0]) {
    return this.control.goLive(input);
  }

  pause(input: Parameters<ISaleroomService["pause"]>[0]) {
    return this.control.pause(input);
  }

  resume(input: Parameters<ISaleroomService["resume"]>[0]) {
    return this.control.resume(input);
  }

  advanceToLot(input: Parameters<ISaleroomService["advanceToLot"]>[0]) {
    return this.control.advanceToLot(input);
  }

  hammerCurrentLot(input: Parameters<ISaleroomService["hammerCurrentLot"]>[0]) {
    return this.control.hammerCurrentLot(input);
  }

  noSaleCurrentLot(input: Parameters<ISaleroomService["noSaleCurrentLot"]>[0]) {
    return this.control.noSaleCurrentLot(input);
  }

  closeSession(input: Parameters<ISaleroomService["closeSession"]>[0]) {
    return this.control.closeSession(input);
  }

  publishClerkPaddleBidSummary(
    input: Parameters<ISaleroomService["publishClerkPaddleBidSummary"]>[0],
  ) {
    return this.display.publishClerkPaddleBidSummary(input);
  }

  clearDisplayOverlayIfAny(saleId: string) {
    return this.display.clearDisplayOverlayIfAny(saleId);
  }
}
