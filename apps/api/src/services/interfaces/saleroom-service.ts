import type { saleroomEvent, saleroomSession } from "@auction/db/schema";
import type { Result } from "neverthrow";

export type SaleroomServiceError = { message: string; status: number; code?: string };

export type SaleroomLotSnapshot = {
  lotId: string;
  status: string;
  currentPrice: string;
  reservePrice: string | null;
};

export type SaleroomSessionSnapshot = {
  session: typeof saleroomSession.$inferSelect | null;
  events: (typeof saleroomEvent.$inferSelect)[];
};

export type PublicSaleroomSessionStatus = {
  status: "none" | "pending" | "live" | "paused" | "ended";
  currentLotId: string | null;
  /** Next advanceable lot in run order; present when session is live/paused. */
  nextLotId?: string | null;
};

export type SaleroomSessionStatusRow = PublicSaleroomSessionStatus & {
  saleId: string;
};

export interface ISaleroomSessionReadService {
  getPublicSessionStatus(saleId: string): Promise<PublicSaleroomSessionStatus>;
  getSessionStatuses(saleIds: readonly string[]): Promise<SaleroomSessionStatusRow[]>;
  getSessionWithRecentEvents(saleId: string): Promise<SaleroomSessionSnapshot>;
  /** The lot's price and reserve now, for the clerk console; null if it is not in this sale. */
  getLotSnapshot(saleId: string, lotId: string): Promise<SaleroomLotSnapshot | null>;
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
    /** The lot the clerk saw on the block; refused with `lot_not_on_block` if it moved on. */
    lotId?: string;
  }): Promise<Result<{ lotId: string }, SaleroomServiceError>>;
  noSaleCurrentLot(input: {
    saleId: string;
    actorUserId: string;
    /** The lot the clerk saw on the block; refused with `lot_not_on_block` if it moved on. */
    lotId?: string;
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

/** Full saleroom facade port exposed on the container (read + control + display). */
export type SaleroomServicePort = ISaleroomSessionReadService &
  ISaleroomSessionControlService &
  ISaleroomDisplayControlService;
