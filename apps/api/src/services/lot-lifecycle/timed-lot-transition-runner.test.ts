import type { IBidRepository, ILotRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import {
  baseLot,
  bid,
  createFactory,
  createTimedRunnerStack,
} from "./lot-lifecycle.test-helpers.js";

describe("TimedLotTransitionRunner", () => {
  it("does not set winner when reserve is not met", async () => {
    const lot = baseLot({
      reservePrice: "1000.00",
      currentPrice: "500.00",
    });

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
      listForLotSettlement: vi.fn().mockResolvedValue([bid({ amount: "500.00" })]),
      findEligibleBidsForLotClose: vi.fn(),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["u1"]),
    } as unknown as IBidRepository;

    const { timedRunner } = createTimedRunnerStack({
      repos: createFactory(lots, bids),
    });
    await timedRunner.runTransitions(new Date());

    expect(lots.setWinner).not.toHaveBeenCalled();
    expect(lots.updateStatus).toHaveBeenCalledWith("a1", "ended");
  });

  it("sets winner when reserve is met", async () => {
    const lot = baseLot({
      reservePrice: "400.00",
      currentPrice: "500.00",
    });

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

    const { timedRunner } = createTimedRunnerStack({
      repos: createFactory(lots, bids),
    });
    await timedRunner.runTransitions(new Date());

    expect(lots.setWinner).toHaveBeenCalledWith("a1", "winner", "winner-entity");
    expect(lots.updateStatus).toHaveBeenCalledWith("a1", "ended");
  });

  it("voids lot when anti-shilling blocks every eligible bid at close", async () => {
    const lotRow = baseLot({ reservePrice: "100.00" });
    const lots: ILotRepository = {
      findScheduledToActivate: vi.fn().mockResolvedValue([]),
      findActivePastEnd: vi.fn().mockResolvedValue([lotRow]),
      findActiveByEndTimeBetween: vi.fn().mockResolvedValue([]),
      findByIdForUpdate: vi.fn().mockResolvedValue(lotRow),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchLots: vi.fn().mockResolvedValue([]),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn().mockResolvedValue(true),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const findEligible = vi.fn().mockResolvedValue([]);
    const bids: IBidRepository = {
      listForLotSettlement: vi
        .fn()
        .mockResolvedValue([
          bid({ amount: "500.00", bidderId: "u1" }),
          bid({ amount: "400.00", bidderId: "u2" }),
        ]),
      findEligibleBidsForLotClose: findEligible,
      listDistinctBidderIds: vi.fn().mockResolvedValue(["u1", "u2"]),
    } as unknown as IBidRepository;

    const guard = {
      bidderSharesSellerLegalEntity: vi.fn().mockResolvedValue(false),
      violatesAntiShilling: vi.fn().mockResolvedValue(true),
    };

    const publish = vi.fn().mockResolvedValue(undefined);
    const publisher = mockDomainEventSink(publish);

    const { timedRunner } = createTimedRunnerStack({
      repos: createFactory(lots, bids),
      antiShillingGuard: guard,
      domainEventSink: publisher,
    });
    await timedRunner.runTransitions(new Date());

    expect(lots.voidLotAntiShillingClose).toHaveBeenCalledWith("a1");
    expect(lots.setWinner).not.toHaveBeenCalled();
    expect(lots.updateStatus).not.toHaveBeenCalled();
    expect(findEligible).toHaveBeenCalledTimes(1);
    expect(findEligible).toHaveBeenCalledWith("a1", {
      sellerLegalEntityId: "se-1",
      reservePrice: "100.00",
      sort: "english",
    });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "lot.voided",
        payload: expect.objectContaining({ reason: "no_valid_winner" }),
      }),
    );
  });

  it("selects first SQL-eligible bid in one query when higher bids violate anti-shilling", async () => {
    const lotRow = baseLot({ reservePrice: "100.00" });
    const lots: ILotRepository = {
      findScheduledToActivate: vi.fn().mockResolvedValue([]),
      findActivePastEnd: vi.fn().mockResolvedValue([lotRow]),
      findActiveByEndTimeBetween: vi.fn().mockResolvedValue([]),
      findByIdForUpdate: vi.fn().mockResolvedValue(lotRow),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchLots: vi.fn().mockResolvedValue([]),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn().mockResolvedValue(true),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const settlementBids = Array.from({ length: 10 }, (_, i) =>
      bid({
        id: `bid-${i}`,
        amount: `${1000 - i * 100}.00`,
        bidderId: `u${i}`,
        buyerLegalEntityId: `entity-u${i}`,
      }),
    );
    const winnerBid = settlementBids[3];
    if (!winnerBid) throw new Error("expected settlementBids[3]");
    const findEligible = vi.fn().mockResolvedValue([winnerBid]);
    const bids: IBidRepository = {
      listForLotSettlement: vi.fn().mockResolvedValue(settlementBids),
      findEligibleBidsForLotClose: findEligible,
      listDistinctBidderIds: vi.fn().mockResolvedValue(settlementBids.map((b) => b.bidderId)),
    } as unknown as IBidRepository;

    const guard = {
      bidderSharesSellerLegalEntity: vi.fn(),
      violatesAntiShilling: vi.fn(),
    };

    const { timedRunner } = createTimedRunnerStack({
      repos: createFactory(lots, bids),
      antiShillingGuard: guard,
    });
    await timedRunner.runTransitions(new Date());

    expect(findEligible).toHaveBeenCalledTimes(1);
    expect(lots.setWinner).toHaveBeenCalledWith(
      "a1",
      winnerBid.placedByUserId,
      winnerBid.buyerLegalEntityId,
    );
    expect(guard.violatesAntiShilling).not.toHaveBeenCalled();
  });

  it("skips timed close when lot is under a live clerk session", async () => {
    const lot = baseLot({
      endTime: new Date(Date.now() - 60_000),
    });

    const lots: ILotRepository = {
      findScheduledToActivate: vi.fn().mockResolvedValue([]),
      findActivePastEnd: vi.fn().mockResolvedValue([lot]),
      findActiveByEndTimeBetween: vi.fn().mockResolvedValue([]),
      findByIdForUpdate: vi.fn(),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchLots: vi.fn().mockResolvedValue([]),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn().mockResolvedValue(true),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const bids: IBidRepository = {
      listForLotSettlement: vi.fn(),
      findEligibleBidsForLotClose: vi.fn(),
      listDistinctBidderIds: vi.fn(),
    } as unknown as IBidRepository;

    const saleroomSessionLookup = {
      shouldSkipAntiSnipeForLot: vi.fn(),
      shouldEnforceOnBlockGateForLot: vi.fn(),
      isLotUnderLiveClerkSession: vi.fn().mockResolvedValue(true),
    };

    const { timedRunner } = createTimedRunnerStack({
      repos: createFactory(lots, bids),
      saleroomSessionLookup,
    });

    await timedRunner.runTransitions(new Date());
    expect(lots.updateStatus).not.toHaveBeenCalled();
    expect(saleroomSessionLookup.isLotUnderLiveClerkSession).toHaveBeenCalledWith("a1");
  });
});
