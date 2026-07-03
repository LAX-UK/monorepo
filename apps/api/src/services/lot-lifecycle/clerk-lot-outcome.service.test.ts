import { describe, expect, it, vi } from "vitest";
import type { INotificationOutboxService } from "../interfaces/notification-outbox.js";
import type { IBidRepository, ILotRepository } from "../interfaces/repositories.js";
import {
  baseLot,
  bid,
  createClerkOutcomeStack,
  createFactory,
} from "./lot-lifecycle.test-helpers.js";

describe("ClerkLotOutcomeService", () => {
  it("stages lot_lost for bidders on clerk no-sale", async () => {
    const lot = baseLot();

    const lots: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      findByIdForUpdate: vi.fn().mockResolvedValue(lot),
      updateStatus: vi.fn(),
      findScheduledToActivate: vi.fn(),
      findActivePastEnd: vi.fn(),
      findActiveByEndTimeBetween: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchLots: vi.fn(),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn(),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const clearWinningBid = vi.fn();
    const bids: IBidRepository = {
      listForLotSettlement: vi.fn().mockResolvedValue([bid({ amount: "500.00" })]),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["bidder-a"]),
      clearWinningBid,
    } as unknown as IBidRepository;

    const stageDispatch = vi.fn().mockResolvedValue(undefined);
    const notificationOutbox: INotificationOutboxService = { stageDispatch };

    const { clerkOutcomes } = createClerkOutcomeStack({
      repos: createFactory(lots, bids),
      notificationOutbox,
    });

    await expect(clerkOutcomes.noSaleEndActiveLotFromClerk("a1")).resolves.toBe(true);
    expect(clearWinningBid).toHaveBeenCalledWith("a1");
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "bidder-a",
        idempotencyKey: "lot_lost:a1:bidder-a",
      }),
      expect.anything(),
    );
  });

  it("does not set winner on clerk hammer when reserve is not met", async () => {
    const lotRow = baseLot({
      reservePrice: "1000.00",
      currentPrice: "500.00",
    });
    const lots: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lotRow),
      findByIdForUpdate: vi.fn().mockResolvedValue(lotRow),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findScheduledToActivate: vi.fn(),
      findActivePastEnd: vi.fn(),
      findActiveByEndTimeBetween: vi.fn(),
      findActiveDutchLots: vi.fn(),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn(),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const clearWinningBid = vi.fn();
    const bids: IBidRepository = {
      findEligibleBidsForLotClose: vi
        .fn()
        .mockResolvedValue([bid({ amount: "500.00", buyerLegalEntityId: "le-1" })]),
      listForLotSettlement: vi
        .fn()
        .mockResolvedValue([bid({ amount: "500.00", buyerLegalEntityId: "le-1" })]),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["u1"]),
      clearWinningBid,
    } as unknown as IBidRepository;

    const { clerkOutcomes } = createClerkOutcomeStack({
      repos: createFactory(lots, bids),
    });

    const outcome = await clerkOutcomes.finalizeActiveLotFromClerkHammer("a1");
    expect(outcome?.winnerId).toBeNull();
    expect(lots.setWinner).not.toHaveBeenCalled();
    expect(clearWinningBid).toHaveBeenCalledWith("a1");
  });
});
