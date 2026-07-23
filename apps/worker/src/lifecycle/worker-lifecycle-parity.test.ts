import {
  ClerkLotOutcomeService,
  LotLifecycleService,
  TimedLotTransitionRunner,
} from "@auction/lot-lifecycle-app";
import type { ILotLifecycleNotifications } from "@auction/lot-lifecycle-app";
import type { IBidRepository, ILotRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { createWorkerLifecycleExecutor } from "./create-worker-lifecycle-executor.js";
import { baseLot, bid, createFactory } from "./worker-lifecycle-parity.helpers.js";

const noopNotifications: ILotLifecycleNotifications = {
  notifyWatchlistStarting: vi.fn(),
  notifyEndingSoonBuckets: vi.fn(),
  notifyBiddersAfterLotClose: vi.fn(),
  stageLotCloseNotificationsInTransaction: vi.fn(),
};

function createWorkerParityStack(opts: {
  lots: ILotRepository;
  bids: IBidRepository;
  antiShillingGuard?: {
    bidderSharesSellerLegalEntity: ReturnType<typeof vi.fn>;
    violatesAntiShilling: ReturnType<typeof vi.fn>;
  } | null;
  saleroomSessionLookup?: {
    isLotUnderLiveClerkSession: ReturnType<typeof vi.fn>;
    shouldSkipAntiSnipeForLot: ReturnType<typeof vi.fn>;
    shouldEnforceOnBlockGateForLot: ReturnType<typeof vi.fn>;
  } | null;
  onLotActivated?: ((lotId: string) => Promise<void>) | null;
}) {
  const repos = createFactory(opts.lots, opts.bids);
  const clerk = new ClerkLotOutcomeService(
    repos,
    noopNotifications,
    opts.antiShillingGuard ?? null,
    null,
    null,
  );
  const timed = new TimedLotTransitionRunner(
    repos,
    noopNotifications,
    clerk,
    opts.saleroomSessionLookup ?? null,
    null,
    opts.onLotActivated ?? null,
  );
  return new LotLifecycleService(clerk, timed);
}

describe("worker lifecycle parity (shared lot-lifecycle-app stack)", () => {
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

    const service = createWorkerParityStack({ lots, bids });
    await service.runTransitions(new Date());

    expect(lots.setWinner).not.toHaveBeenCalled();
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

    const service = createWorkerParityStack({ lots, bids, antiShillingGuard: guard });
    await service.runTransitions(new Date());

    expect(lots.voidLotAntiShillingClose).toHaveBeenCalledWith("a1");
    expect(lots.setWinner).not.toHaveBeenCalled();
    expect(findEligible).toHaveBeenCalledTimes(1);
  });

  it("skips timed close for lots under live clerk session", async () => {
    const lot = baseLot();
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

    const bids = {
      listForLotSettlement: vi.fn(),
      findEligibleBidsForLotClose: vi.fn(),
      listDistinctBidderIds: vi.fn(),
    } as unknown as IBidRepository;

    const saleroomSessionLookup = {
      isLotUnderLiveClerkSession: vi.fn().mockResolvedValue(true),
      shouldSkipAntiSnipeForLot: vi.fn().mockResolvedValue(true),
      shouldEnforceOnBlockGateForLot: vi.fn().mockResolvedValue(false),
    };

    const service = createWorkerParityStack({ lots, bids, saleroomSessionLookup });
    await service.runTransitions(new Date());

    expect(saleroomSessionLookup.isLotUnderLiveClerkSession).toHaveBeenCalledWith("a1");
    expect(lots.findByIdForUpdate).not.toHaveBeenCalled();
  });

  it("invokes onLotActivated when scheduled lots activate", async () => {
    const lot = baseLot({ status: "scheduled" });
    const lots: ILotRepository = {
      findScheduledToActivate: vi.fn().mockResolvedValue([lot]),
      findActivePastEnd: vi.fn().mockResolvedValue([]),
      findActiveByEndTimeBetween: vi.fn().mockResolvedValue([]),
      findByIdForUpdate: vi.fn().mockResolvedValue({ ...lot, status: "scheduled" }),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchLots: vi.fn().mockResolvedValue([]),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn().mockResolvedValue(true),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const bids = {
      listForLotSettlement: vi.fn(),
      findEligibleBidsForLotClose: vi.fn(),
      listDistinctBidderIds: vi.fn(),
    } as unknown as IBidRepository;

    const onLotActivated = vi.fn().mockResolvedValue(undefined);
    const service = createWorkerParityStack({ lots, bids, onLotActivated });
    await service.runTransitions(new Date());

    expect(onLotActivated).toHaveBeenCalledWith("a1");
  });
});

describe("createWorkerLifecycleExecutor wiring", () => {
  it("exports parity stack entrypoints from worker lifecycle module", () => {
    expect(createWorkerLifecycleExecutor).toBeTypeOf("function");
  });
});
