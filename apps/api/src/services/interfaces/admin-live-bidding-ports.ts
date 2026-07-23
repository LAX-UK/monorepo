import type { Result } from "neverthrow";
import type { BidError } from "../../lib/errors.js";
import type {
  PaddleBidResolution,
  PaddleRosterEntry,
  PaddleServiceError,
} from "../paddle.service.js";
import type { IBidPlacerWithIdempotency } from "./place-bid.js";

/** Assert the lot is the current on-block lot for a live saleroom session. */
export interface ISaleroomLotOnBlockAsserter {
  assertLotOnBlock(saleId: string, lotId: string): Promise<Result<void, BidError>>;
}

/** Resolve paddle eligibility before clerk paddle bids. */
export interface IPaddleSaleroomBidPolicy {
  assertPaddleAllowsBid(input: {
    saleId: string;
    paddleNumber: number;
    lotId: string;
  }): Promise<Result<PaddleBidResolution, BidError>>;
}

export type AdminPaddleAssignInput = {
  saleId: string;
  registrationId: string;
  paddleNumber?: number;
  clerkUserId: string;
};

export type AdminPaddleClearInput = {
  saleId: string;
  registrationId: string;
  clerkUserId: string;
};

/** Clerk paddle assignment, roster, and eligibility (narrow PaddleService surface). */
export interface IAdminPaddleClerkOperations {
  assertPaddleAllowsBid: IPaddleSaleroomBidPolicy["assertPaddleAllowsBid"];
  assignPaddle(
    input: AdminPaddleAssignInput,
  ): Promise<Result<{ paddleNumber: number }, PaddleServiceError>>;
  clearPaddle(input: AdminPaddleClearInput): Promise<Result<void, PaddleServiceError>>;
  listSaleRoster(saleId: string): Promise<PaddleRosterEntry[]>;
}

export interface IAdminBidPlacedCounter {
  recordBidPlaced(): void;
}

export type ClerkPaddleBidSummaryInput = {
  saleId: string;
  lotId: string;
  currentPrice: string;
  bidCount: number;
  leaderPaddleNumber: number;
};

export interface IClerkPaddleBidSummaryPublisher {
  publishClerkPaddleBidSummary(input: ClerkPaddleBidSummaryInput): Promise<void>;
}

export type ClerkPaddleBidTelemetryOutcome = "ok" | "replay" | "error";

export interface IClerkPaddleBidTelemetry {
  recordOutcome(outcome: ClerkPaddleBidTelemetryOutcome): void;
  logPlaced(input: {
    saleId: string;
    lotId: string;
    paddleNumber: number;
    clerkUserId: string;
    outcome: ClerkPaddleBidTelemetryOutcome;
    errorMessage?: string;
  }): void;
}

export type AdminLiveBiddingBidPlacement = Pick<
  IBidPlacerWithIdempotency,
  "placeBidWithIdempotency"
>;
