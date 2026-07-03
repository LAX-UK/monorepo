import type { saleroomEvent, saleroomSession } from "@auction/db/schema";
import type { Result } from "neverthrow";

export type SaleroomServiceError = { message: string; status: number; code?: string };

export type SaleroomSessionSnapshot = {
  session: typeof saleroomSession.$inferSelect | null;
  events: (typeof saleroomEvent.$inferSelect)[];
};

export type PublicSaleroomSessionStatus = {
  status: "none" | "pending" | "live" | "paused" | "ended";
  currentLotId: string | null;
};

export type SaleroomSessionStatusRow = PublicSaleroomSessionStatus & {
  saleId: string;
};

export interface ISaleroomSessionReadService {
  getPublicSessionStatus(saleId: string): Promise<PublicSaleroomSessionStatus>;
  getSessionStatuses(saleIds: readonly string[]): Promise<SaleroomSessionStatusRow[]>;
  getSessionWithRecentEvents(saleId: string): Promise<SaleroomSessionSnapshot>;
}

export interface ISaleroomSessionControlService {
  goLive(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string; status: string }, SaleroomServiceError>>;
  pause(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string }, SaleroomServiceError>>;
  resume(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string }, SaleroomServiceError>>;
  advanceToLot(input: {
    saleId: string;
    lotId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string; currentLotId: string }, SaleroomServiceError>>;
  hammerCurrentLot(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ lotId: string }, SaleroomServiceError>>;
  noSaleCurrentLot(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ lotId: string }, SaleroomServiceError>>;
  closeSession(input: {
    saleId: string;
    actorUserId: string;
  }): Promise<Result<{ sessionId: string }, SaleroomServiceError>>;
}

export interface ISaleroomDisplayControlService {
  publishClerkPaddleBidSummary(input: {
    saleId: string;
    lotId: string;
    currentPrice: string;
    bidCount: number;
    leaderPaddleNumber: number | null;
  }): Promise<void>;
  clearDisplayOverlayIfAny(saleId: string): Promise<void>;
}

export interface ISaleroomService
  extends ISaleroomSessionReadService,
    ISaleroomSessionControlService,
    ISaleroomDisplayControlService {}
