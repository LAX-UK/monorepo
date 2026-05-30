import type { Bid } from "@auction/types";
import type { Result } from "neverthrow";
import { BidError } from "../../lib/errors.js";
import type { IIdempotencyStore } from "../interfaces/idempotency-store.js";
import { IDEMPOTENCY_PENDING_VALUE } from "../interfaces/idempotency-store.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { IBidPlacer } from "../interfaces/place-bid.js";
import type { PlaceBidWithIdempotencyOutcome } from "./place-bid-idempotency.js";

const IDEMPOTENCY_TTL_SEC = 86_400;

export class IdempotentBidExecutor {
  constructor(
    private readonly bidPlacer: IBidPlacer,
    private readonly legalEntityRepository: ILegalEntityRepository | null,
    private readonly idempotencyStore: IIdempotencyStore | null,
  ) {}

  async placeBidWithIdempotency(input: {
    placedByUserId: string;
    buyerLegalEntityId?: string;
    idempotencyKey?: string;
    lotId: string;
    amount: number;
    maxAutoBidAmount?: number;
    autoBidStepAmount?: number;
    placedVia?: string;
    telephoneBookingId?: string;
  }): Promise<PlaceBidWithIdempotencyOutcome> {
    const { placedByUserId, idempotencyKey, lotId, amount, maxAutoBidAmount } = input;
    let idempotencyRedisKey: string | undefined;

    if (idempotencyKey && this.idempotencyStore) {
      idempotencyRedisKey = `idempotency:bid:${placedByUserId}:${idempotencyKey}`;
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
      input.placedVia != null || input.telephoneBookingId != null
        ? {
            ...(input.placedVia != null ? { placedVia: input.placedVia } : {}),
            ...(input.telephoneBookingId != null
              ? { telephoneBookingId: input.telephoneBookingId }
              : {}),
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
    for (let i = 0; i < 50; i++) {
      const replay = await this.readIdempotencyReplay(key);
      if (replay) return replay;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return {
      type: "err",
      error: new BidError("Bid still processing; retry shortly", 409, "bid_in_flight"),
    };
  }
}
