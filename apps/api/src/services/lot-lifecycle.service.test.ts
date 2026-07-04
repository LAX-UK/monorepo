import type { IBidRepository, ILotRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import {
  baseLot,
  bid,
  createFactory,
  createLotLifecycleTestStack,
} from "./lot-lifecycle/lot-lifecycle.test-helpers.js";

describe("LotLifecycleService facade", () => {
  it("delegates runTransitions through timed runner", async () => {
    const lot = baseLot({ reservePrice: "400.00" });
    const lots: ILotRepository = {
      findScheduledToActivate: vi.fn().mockResolvedValue([]),
      findActivePastEnd: vi.fn().mockResolvedValue([lot]),
      findActiveByEndTimeBetween: vi.fn().mockResolvedValue([]),
      findByIdForUpdate: vi.fn().mockResolvedValue(lot),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchLots: vi.fn().mockResolvedValue([]),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn().mockResolvedValue(true),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const bids: IBidRepository = {
      listForLotSettlement: vi
        .fn()
        .mockResolvedValue([bid({ amount: "500.00", bidderId: "winner" })]),
      findEligibleBidsForLotClose: vi.fn(),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["winner"]),
    } as unknown as IBidRepository;

    const svc = createLotLifecycleTestStack({
      repos: createFactory(lots, bids),
    });
    await svc.runTransitions(new Date());

    expect(lots.setWinner).toHaveBeenCalledWith("a1", "winner", "winner-entity");
  });

  it("delegates clerk hammer to clerk outcome service", async () => {
    const lotRow = baseLot({ reservePrice: "1000.00" });
    const lots: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lotRow),
      findByIdForUpdate: vi.fn().mockResolvedValue(lotRow),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
    } as unknown as ILotRepository;

    const clearWinningBid = vi.fn();
    const bids: IBidRepository = {
      listForLotSettlement: vi.fn().mockResolvedValue([bid({ amount: "500.00" })]),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["u1"]),
      clearWinningBid,
    } as unknown as IBidRepository;

    const svc = createLotLifecycleTestStack({
      repos: createFactory(lots, bids),
    });

    const outcome = await svc.finalizeActiveLotFromClerkHammer("a1");
    expect(outcome?.winnerId).toBeNull();
    expect(clearWinningBid).toHaveBeenCalledWith("a1");
  });
});
