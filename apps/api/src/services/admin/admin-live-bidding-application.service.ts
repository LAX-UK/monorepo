import type { IBidRepository } from "@auction/persistence";
import type { Redis } from "ioredis";
import { type Result, err } from "neverthrow";
import { BidError } from "../../lib/errors.js";
import { checkPaddleAssignRateLimit } from "../../lib/paddle-assign-rate-limit.js";
import type { AdminMetricsService } from "../admin-metrics.service.js";
import type { BidService } from "../bid.service.js";
import type { PlaceBidWithIdempotencyOutcome } from "../bid/place-bid-idempotency.js";
import type { SaleroomOnBlockPolicy } from "../bid/saleroom-on-block.policy.js";
import type {
  AdminPlacePaddleBidResult,
  IAdminLiveBiddingApplicationService,
} from "../interfaces/admin-routes.js";
import type { ITelephoneBidBookingBidPolicy } from "../interfaces/telephone-bid-booking-service.js";
import type { PaddleService, PaddleServiceError } from "../paddle.service.js";

type RateLimitError = {
  message: string;
  status: 429;
  code: "rate_limited";
};

export class AdminLiveBiddingApplicationService implements IAdminLiveBiddingApplicationService {
  constructor(
    private readonly bids: BidService,
    private readonly onBlockPolicy: SaleroomOnBlockPolicy,
    private readonly paddles: PaddleService,
    private readonly telephoneBookings: ITelephoneBidBookingBidPolicy,
    private readonly adminMetrics: AdminMetricsService,
    private readonly bidRepo: IBidRepository,
    private readonly redis: Redis,
    private readonly findLotById: (lotId: string) => Promise<{ id: string; saleId: string } | null>,
  ) {}

  async placePaddleBid(input: {
    saleId: string;
    lotId: string;
    paddleNumber: number;
    amount: number;
    clerkUserId: string;
    maxAutoBidAmount?: number | undefined;
    idempotencyKey?: string | undefined;
  }): Promise<AdminPlacePaddleBidResult> {
    const onBlock = await this.onBlockPolicy.assertLotOnBlock(input.saleId, input.lotId);
    if (onBlock.isErr()) {
      return { type: "err", error: onBlock.error };
    }

    const resolution = await this.paddles.assertPaddleAllowsBid({
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

    const out = await this.bids.placeBidWithIdempotency({
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

    this.adminMetrics.recordBidPlaced();
    const bidCount = await this.bidRepo.countForLot(input.lotId);

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
    const lotRow = await this.findLotById(input.lotId);
    if (!lotRow?.saleId) {
      return { type: "err", error: new BidError("Lot not found", 404) };
    }

    const onBlock = await this.onBlockPolicy.assertLotOnBlock(lotRow.saleId, input.lotId);
    if (onBlock.isErr()) {
      return { type: "err", error: onBlock.error };
    }

    if (input.telephoneBookingId) {
      const bookingCheck = await this.telephoneBookings.assertBookingAllowsTelephoneBid({
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

    return this.bids.placeBidWithIdempotency({
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
    input: Parameters<PaddleService["assignPaddle"]>[0],
  ): Promise<Result<{ paddleNumber: number }, PaddleServiceError | RateLimitError>> {
    const allowed = await checkPaddleAssignRateLimit(this.redis, input.clerkUserId);
    if (!allowed) {
      return err({
        message: "Too many paddle assignments",
        status: 429,
        code: "rate_limited",
      });
    }
    return this.paddles.assignPaddle(input);
  }

  clearPaddle(...args: Parameters<PaddleService["clearPaddle"]>) {
    return this.paddles.clearPaddle(...args);
  }

  listSaleRoster(...args: Parameters<PaddleService["listSaleRoster"]>) {
    return this.paddles.listSaleRoster(...args);
  }
}
