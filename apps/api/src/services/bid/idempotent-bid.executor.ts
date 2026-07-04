import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { Bid } from "@auction/types";
import type { Result } from "neverthrow";
import { Counter, Histogram } from "prom-client";
import { BidError } from "../../lib/errors.js";
import type { IIdempotencyStore } from "../interfaces/idempotency-store.js";
import { IDEMPOTENCY_PENDING_VALUE } from "../interfaces/idempotency-store.js";
import type { IBidPlacer, PlaceBidWithIdempotencyInput } from "../interfaces/place-bid.js";
import type { PlaceBidWithIdempotencyOutcome } from "./place-bid-idempotency.js";

const IDEMPOTENCY_TTL_SEC = 86_400;
const IDEMPOTENCY_WAIT_MAX_POLLS = 100;
const IDEMPOTENCY_WAIT_POLL_MS = 100;

const bidIdempotencyWaitDurationMs = new Histogram({
  name: "bid_idempotency_wait_duration_ms",
  help: "Time spent waiting for an in-flight idempotent bid to finish",
  buckets: [100, 250, 500, 1000, 2500, 5000, 7500, 10000],
});

const bidIdempotencyWaitTimeoutTotal = new Counter({
  name: "bid_idempotency_wait_timeout_total",
  help: "Idempotent bid requests that timed out waiting for an in-flight placement",
});

export class IdempotentBidExecutor {
  constructor(
    private readonly bidPlacer: IBidPlacer,
    private readonly legalEntityRepository: ILegalEntityRepository | null,
    private readonly idempotencyStore: IIdempotencyStore | null,
  ) {}

  async placeBidWithIdempotency(
    input: PlaceBidWithIdempotencyInput,
  ): Promise<PlaceBidWithIdempotencyOutcome> {
    const { placedByUserId, idempotencyKey, lotId, amount, maxAutoBidAmount } = input;
    let idempotencyRedisKey: string | undefined;

    if (idempotencyKey && this.idempotencyStore) {
      idempotencyRedisKey = `idempotency:bid:${placedByUserId}:${lotId}:${idempotencyKey}`;
      const replay = await this.readIdempotencyReplay(idempotencyRedisKey);
      if (replay) return replay;

      const claimed = await this.idempotencyStore.tryClaim(
        idempotencyRedisKey,
        IDEMPOTENCY_TTL_SEC,
      );
      if (!claimed) {
        const waited = await this.waitForIdempotencyReplay(idempotencyRedisKey);
        if (waited) return waited;
      }
    }

    if (!this.legalEntityRepository) {
      if (idempotencyRedisKey && this.idempotencyStore) {
        await this.idempotencyStore.delete(idempotencyRedisKey);
      }
      return { type: "err", error: new BidError("Bid placement is not configured", 503) };
    }

    let buyerLegalEntityId = input.buyerLegalEntityId?.trim();
    if (!buyerLegalEntityId) {
      const buyerEntity = await this.legalEntityRepository.ensurePersonalEntity(placedByUserId);
      buyerLegalEntityId = buyerEntity.id;
    }

    const placement =
      input.placedVia != null ||
      input.telephoneBookingId != null ||
      input.clerkUserId != null ||
      input.saleId != null ||
      input.paddleNumber != null
        ? {
            ...(input.placedVia != null ? { placedVia: input.placedVia } : {}),
            ...(input.telephoneBookingId != null
              ? { telephoneBookingId: input.telephoneBookingId }
              : {}),
            ...(input.clerkUserId != null ? { clerkUserId: input.clerkUserId } : {}),
            ...(input.saleId != null ? { saleId: input.saleId } : {}),
            ...(input.paddleNumber != null ? { paddleNumber: input.paddleNumber } : {}),
          }
        : undefined;

    let result: Result<Bid, BidError>;
    try {
      result = await this.bidPlacer.placeBid({
        placedByUserId,
        buyerLegalEntityId,
        lotId,
        amount,
        ...(maxAutoBidAmount !== undefined ? { maxAutoBidAmount } : {}),
        ...(input.autoBidStepAmount !== undefined
          ? { autoBidStepAmount: input.autoBidStepAmount }
          : {}),
        ...(placement !== undefined ? { placement } : {}),
      });
    } catch (e) {
      if (idempotencyRedisKey && this.idempotencyStore) {
        await this.idempotencyStore.delete(idempotencyRedisKey);
      }
      throw e;
    }

    if (result.isErr()) {
      if (idempotencyRedisKey && this.idempotencyStore) {
        await this.idempotencyStore.delete(idempotencyRedisKey);
      }
      return { type: "err", error: result.error };
    }

    const bid = result.value;
    const body = { data: bid };

    if (idempotencyRedisKey && this.idempotencyStore) {
      await this.idempotencyStore.setWithExpiry(
        idempotencyRedisKey,
        JSON.stringify(body),
        IDEMPOTENCY_TTL_SEC,
      );
    }

    return { type: "ok", body };
  }

  private async readIdempotencyReplay(
    key: string,
  ): Promise<Extract<PlaceBidWithIdempotencyOutcome, { type: "replay" }> | null> {
    if (!this.idempotencyStore) return null;
    const cached = await this.idempotencyStore.get(key);
    if (!cached || cached === IDEMPOTENCY_PENDING_VALUE) return null;
    return { type: "replay", body: JSON.parse(cached) as { data: Bid } };
  }

  private async waitForIdempotencyReplay(
    key: string,
  ): Promise<PlaceBidWithIdempotencyOutcome | null> {
    if (!this.idempotencyStore) return null;
    const waitStartedAt = Date.now();
    for (let i = 0; i < IDEMPOTENCY_WAIT_MAX_POLLS; i++) {
      const replay = await this.readIdempotencyReplay(key);
      if (replay) {
        bidIdempotencyWaitDurationMs.observe(Date.now() - waitStartedAt);
        return replay;
      }
      await new Promise((resolve) => setTimeout(resolve, IDEMPOTENCY_WAIT_POLL_MS));
    }
    bidIdempotencyWaitDurationMs.observe(Date.now() - waitStartedAt);
    bidIdempotencyWaitTimeoutTotal.inc();
    return {
      type: "err",
      error: new BidError("Bid still processing; retry shortly", 409, "bid_in_flight"),
    };
  }
}
