import type { PlaceBidWithIdempotencyOutcome } from "@auction/bidding-runtime";
import type { IBidRepository } from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import { type Result, err } from "neverthrow";
import { BidError } from "../../lib/errors.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { checkPaddleAssignRateLimit } from "../../lib/paddle-assign-rate-limit.js";
import type {
  AdminLiveBiddingBidPlacement,
  AdminPaddleAssignInput,
  AdminPaddleClearInput,
  IAdminBidPlacedCounter,
  IAdminPaddleClerkOperations,
  IClerkPaddleBidSummaryPublisher,
  IClerkPaddleBidTelemetry,
  ISaleroomLotOnBlockAsserter,
} from "../interfaces/admin-live-bidding-ports.js";
import type {
  AdminPlacePaddleBidResult,
  ClerkPaddleBidHttpResult,
  IAdminLiveBiddingApplicationService,
} from "../interfaces/admin-routes.js";
import type { ITelephoneBidBookingBidPolicy } from "../interfaces/telephone-bid-booking-service.js";
import type { PaddleServiceError } from "../paddle.service.js";

type RateLimitError = {
  message: string;
  status: 429;
  code: "rate_limited";
};

export type AdminLiveBiddingApplicationServiceDeps = {
  bidPlacer: AdminLiveBiddingBidPlacement;
  onBlockPolicy: ISaleroomLotOnBlockAsserter;
  paddleClerk: IAdminPaddleClerkOperations;
  telephoneBookings: ITelephoneBidBookingBidPolicy;
  adminMetrics: IAdminBidPlacedCounter;
  bidRepo: IBidRepository;
  redis: Redis;
  findLotById: (lotId: string) => Promise<{ id: string; saleId: string } | null>;
  clerkPaddleBidSummaryPublisher: IClerkPaddleBidSummaryPublisher;
  clerkPaddleBidTelemetry: IClerkPaddleBidTelemetry;
};

export class AdminLiveBiddingApplicationService implements IAdminLiveBiddingApplicationService {
  constructor(private readonly deps: AdminLiveBiddingApplicationServiceDeps) {}

  async placeClerkPaddleBid(input: {
    saleId: string;
    lotId: string;
    paddleNumber: number;
    amount: number;
    clerkUserId: string;
    maxAutoBidAmount?: number | undefined;
    idempotencyKey?: string | undefined;
  }): Promise<ClerkPaddleBidHttpResult> {
    const out = await this.placePaddleBid(input);
    const telemetryInput = {
      saleId: input.saleId,
      lotId: input.lotId,
      paddleNumber: input.paddleNumber,
      clerkUserId: input.clerkUserId,
    };

    if (out.type === "replay") {
      this.deps.clerkPaddleBidTelemetry.recordOutcome("replay");
      this.deps.clerkPaddleBidTelemetry.logPlaced({ ...telemetryInput, outcome: "replay" });
      return { httpStatus: 201, body: out.body };
    }

    if (out.type === "err") {
      this.deps.clerkPaddleBidTelemetry.recordOutcome("error");
      this.deps.clerkPaddleBidTelemetry.logPlaced({
        ...telemetryInput,
        outcome: "error",
        errorMessage: out.error.message,
      });
      const e = out.error;
      return {
        httpStatus: asHttpStatus(e.status),
        body: e.code ? { error: e.message, code: e.code } : { error: e.message },
      };
    }

    if (out.type === "ok_with_summary") {
      this.deps.clerkPaddleBidTelemetry.recordOutcome("ok");
      void this.deps.clerkPaddleBidSummaryPublisher.publishClerkPaddleBidSummary({
        saleId: input.saleId,
        lotId: input.lotId,
        currentPrice: out.body.data.amount,
        bidCount: out.bidCount,
        leaderPaddleNumber: input.paddleNumber,
      });
      this.deps.clerkPaddleBidTelemetry.logPlaced({ ...telemetryInput, outcome: "ok" });
      return { httpStatus: 201, body: out.body };
    }

    return { httpStatus: 201, body: out.body };
  }

  async placePaddleBid(input: {
    saleId: string;
    lotId: string;
    paddleNumber: number;
    amount: number;
    clerkUserId: string;
    maxAutoBidAmount?: number | undefined;
    idempotencyKey?: string | undefined;
  }): Promise<AdminPlacePaddleBidResult> {
    const onBlock = await this.deps.onBlockPolicy.assertLotOnBlock(input.saleId, input.lotId);
    if (onBlock.isErr()) {
      return { type: "err", error: onBlock.error };
    }

    const resolution = await this.deps.paddleClerk.assertPaddleAllowsBid({
      saleId: input.saleId,
      paddleNumber: input.paddleNumber,
      lotId: input.lotId,
    });
    if (resolution.isErr()) {
      return { type: "err", error: resolution.error };
    }

    const resolved = resolution.value;
    const idempotencyKey =
      input.idempotencyKey ??
      `paddle:${input.saleId}:${input.paddleNumber}:${input.lotId}:${input.amount}`;

    const out = await this.deps.bidPlacer.placeBidWithIdempotency({
      placedByUserId: resolved.userId,
      buyerLegalEntityId: resolved.buyerLegalEntityId,
      lotId: input.lotId,
      amount: input.amount,
      ...(input.maxAutoBidAmount !== undefined ? { maxAutoBidAmount: input.maxAutoBidAmount } : {}),
      placedVia: "saleroom",
      clerkUserId: input.clerkUserId,
      saleId: input.saleId,
      paddleNumber: input.paddleNumber,
      idempotencyKey,
    });

    if (out.type === "replay" || out.type === "err") {
      return out;
    }

    this.deps.adminMetrics.recordBidPlaced();
    const bidCount = await this.deps.bidRepo.countForLot(input.lotId);

    return {
      type: "ok_with_summary",
      body: out.body,
      bidCount,
    };
  }

  async placeTelephoneBid(input: {
    lotId: string;
    buyerUserId: string;
    buyerLegalEntityId: string;
    amount: number;
    clerkUserId: string;
    maxAutoBidAmount?: number | undefined;
    telephoneBookingId?: string | undefined;
    idempotencyKey?: string | undefined;
  }): Promise<PlaceBidWithIdempotencyOutcome> {
    const lotRow = await this.deps.findLotById(input.lotId);
    if (!lotRow?.saleId) {
      return { type: "err", error: new BidError("Lot not found", 404) };
    }

    const onBlock = await this.deps.onBlockPolicy.assertLotOnBlock(lotRow.saleId, input.lotId);
    if (onBlock.isErr()) {
      return { type: "err", error: onBlock.error };
    }

    if (input.telephoneBookingId) {
      const bookingCheck = await this.deps.telephoneBookings.assertBookingAllowsTelephoneBid({
        bookingId: input.telephoneBookingId,
        saleId: lotRow.saleId,
        lotId: input.lotId,
        amount: input.amount,
        ...(input.maxAutoBidAmount !== undefined
          ? { maxAutoBidAmount: input.maxAutoBidAmount }
          : {}),
      });
      if (bookingCheck.isErr()) {
        const e = bookingCheck.error;
        return {
          type: "err",
          error: new BidError(e.message, e.status, e.code),
        };
      }
    }

    const idempotencyKey =
      input.idempotencyKey ??
      (input.telephoneBookingId
        ? `telephone-booking:${input.lotId}:${input.telephoneBookingId}:${input.amount}`
        : `telephone-clerk:${input.lotId}:${input.clerkUserId}:${input.buyerUserId}:${input.amount}`);

    return this.deps.bidPlacer.placeBidWithIdempotency({
      placedByUserId: input.buyerUserId,
      buyerLegalEntityId: input.buyerLegalEntityId,
      lotId: input.lotId,
      amount: input.amount,
      ...(input.maxAutoBidAmount !== undefined ? { maxAutoBidAmount: input.maxAutoBidAmount } : {}),
      placedVia: "telephone",
      clerkUserId: input.clerkUserId,
      ...(input.telephoneBookingId != null ? { telephoneBookingId: input.telephoneBookingId } : {}),
      idempotencyKey,
    });
  }

  async assignPaddle(
    input: AdminPaddleAssignInput,
  ): Promise<Result<{ paddleNumber: number }, PaddleServiceError | RateLimitError>> {
    const allowed = await checkPaddleAssignRateLimit(this.deps.redis, input.clerkUserId);
    if (!allowed) {
      return err({
        message: "Too many paddle assignments",
        status: 429,
        code: "rate_limited",
      });
    }
    return this.deps.paddleClerk.assignPaddle(input);
  }

  clearPaddle(input: AdminPaddleClearInput) {
    return this.deps.paddleClerk.clearPaddle(input);
  }

  listSaleRoster(saleId: string) {
    return this.deps.paddleClerk.listSaleRoster(saleId);
  }
}
