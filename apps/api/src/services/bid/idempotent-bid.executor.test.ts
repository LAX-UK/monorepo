import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BidError } from "../../lib/errors.js";
import type { IIdempotencyStore } from "../interfaces/idempotency-store.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { IBidPlacer } from "../interfaces/place-bid.js";
import { IdempotentBidExecutor } from "./idempotent-bid.executor.js";

describe("IdempotentBidExecutor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits up to 10s for replay before returning bid_in_flight", async () => {
    const bidPlacer: IBidPlacer = {
      placeBid: vi.fn(),
    };
    const legalEntityRepository: ILegalEntityRepository = {
      findById: vi.fn(),
      ensurePersonalEntity: vi.fn().mockResolvedValue({ id: "le-1" }),
    } as unknown as ILegalEntityRepository;
    const idempotencyStore: IIdempotencyStore = {
      get: vi.fn().mockResolvedValue(null),
      tryClaim: vi.fn().mockResolvedValue(false),
      setWithExpiry: vi.fn(),
      delete: vi.fn(),
    };

    const executor = new IdempotentBidExecutor(bidPlacer, legalEntityRepository, idempotencyStore);
    const promise = executor.placeBidWithIdempotency({
      placedByUserId: "u1",
      lotId: "lot-1",
      amount: 100,
      idempotencyKey: "k1",
    });

    await vi.advanceTimersByTimeAsync(10_000);

    const result = await promise;
    expect(result.type).toBe("err");
    if (result.type === "err") {
      expect(result.error).toBeInstanceOf(BidError);
      expect(result.error.code).toBe("bid_in_flight");
    }
    expect(idempotencyStore.get).toHaveBeenCalled();
  });
});
