import type { Database } from "@auction/db";
import type { Bid, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { INotificationOutboxService } from "./interfaces/notification-outbox.js";
import type { ILotNotificationSender } from "./interfaces/notifications.js";
import type { IBidRepository, ILotRepository } from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import { LotLifecycleService } from "./lot-lifecycle.service.js";
import { NotificationFactory } from "./notification.factory.js";

function bid(overrides: Partial<Bid> = {}): Bid {
  const now = new Date();
  const bidderId = overrides.bidderId ?? overrides.placedByUserId ?? "u1";
  return {
    id: "b1",
    lotId: "a1",
    bidderId,
    placedByUserId: bidderId,
    buyerLegalEntityId: overrides.buyerLegalEntityId ?? `${bidderId}-entity`,
    amount: "500.00",
    isWinning: true,
    isAutoBid: false,
    maxAutoBidAmount: null,
    createdAt: now,
    ...overrides,
  };
}

function baseLot(overrides: Partial<Lot> = {}): Lot {
  const now = new Date();
  return {
    id: "a1",
    saleId: null,
    lotNumber: null,
    sellerId: "s1",
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "c1000001-0000-4000-8000-000000000001",
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: "1000.00",
    buyNowPrice: null,
    currentPrice: "500.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: now,
    status: "active",
    winnerId: null,
    voidedReason: null,
    archivedSeller: false,
    sellerLegalEntityId: "se-1",
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
    ...overrides,
  };
}

function createFactory(lots: ILotRepository, bids: IBidRepository): IRepositoryFactory {
  const root = { lot: lots, bid: bids };
  return {
    root,
    forConnection: () => root,
    runInTransaction: async <T>(fn: (r: typeof root, tx: Database) => Promise<T>) =>
      fn(root, {} as unknown as Database),
  };
}

describe("LotLifecycleService", () => {
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

    const svc = new LotLifecycleService(
      createFactory(lots, bids),
      null,
      null,
      null,
      new NotificationFactory(),
      null,
      null,
      null,
    );
    await svc.runTransitions(new Date());

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

    const svc = new LotLifecycleService(
      createFactory(lots, bids),
      null,
      null,
      null,
      new NotificationFactory(),
      null,
      null,
      null,
    );
    await svc.runTransitions(new Date());

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
    const publisher = { publish } as import("./domain-event.publisher.js").DomainEventPublisher;

    const svc = new LotLifecycleService(
      createFactory(lots, bids),
      null,
      null,
      null,
      new NotificationFactory(),
      guard,
      publisher,
      null,
    );
    await svc.runTransitions(new Date());

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
      expect.anything(),
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

    const svc = new LotLifecycleService(
      createFactory(lots, bids),
      null,
      null,
      null,
      new NotificationFactory(),
      guard,
      null,
      null,
    );
    await svc.runTransitions(new Date());

    expect(findEligible).toHaveBeenCalledTimes(1);
    expect(lots.setWinner).toHaveBeenCalledWith(
      "a1",
      winnerBid.placedByUserId,
      winnerBid.buyerLegalEntityId,
    );
    expect(guard.violatesAntiShilling).not.toHaveBeenCalled();
  });

  it("publishes lot_ended over realtime when reserve is met on timed close", async () => {
    const winningBid = bid({ amount: "500.00", bidderId: "winner" });
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
      listForLotSettlement: vi.fn().mockResolvedValue([winningBid]),
      findEligibleBidsForLotClose: vi.fn(),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["winner"]),
    } as unknown as IBidRepository;

    const notifyLotEnded = vi.fn().mockResolvedValue(undefined);
    const lotNotifications: ILotNotificationSender = {
      notifyLotExtended: vi.fn(),
      notifyLotEnded,
      notifyProxyCancelled: vi.fn(),
    };

    const svc = new LotLifecycleService(
      createFactory(lots, bids),
      null,
      null,
      null,
      new NotificationFactory(),
      null,
      null,
      null,
      null,
      lotNotifications,
    );
    await svc.runTransitions(new Date());

    expect(notifyLotEnded).toHaveBeenCalledWith(lot, winningBid);
  });

  it("publishes lot_ended with null winning bid when reserve is not met on timed close", async () => {
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

    const notifyLotEnded = vi.fn().mockResolvedValue(undefined);
    const lotNotifications: ILotNotificationSender = {
      notifyLotExtended: vi.fn(),
      notifyLotEnded,
      notifyProxyCancelled: vi.fn(),
    };

    const svc = new LotLifecycleService(
      createFactory(lots, bids),
      null,
      null,
      null,
      new NotificationFactory(),
      null,
      null,
      null,
      null,
      lotNotifications,
    );
    await svc.runTransitions(new Date());

    expect(notifyLotEnded).toHaveBeenCalledWith(lot, null);
  });

  it("stages lot_lost for bidders when reserve is not met at timed close", async () => {
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
      listDistinctBidderIds: vi.fn().mockResolvedValue(["u1", "u2"]),
    } as unknown as IBidRepository;

    const stageDispatch = vi.fn().mockResolvedValue(undefined);
    const notificationOutbox: INotificationOutboxService = { stageDispatch };

    const svc = new LotLifecycleService(
      createFactory(lots, bids),
      null,
      null,
      null,
      new NotificationFactory(),
      null,
      null,
      null,
      null,
      null,
      notificationOutbox,
    );
    await svc.runTransitions(new Date());

    expect(stageDispatch).toHaveBeenCalledTimes(2);
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        idempotencyKey: "lot_lost:a1:u1",
      }),
      expect.anything(),
    );
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u2",
        idempotencyKey: "lot_lost:a1:u2",
      }),
      expect.anything(),
    );
  });

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

    const bids: IBidRepository = {
      listDistinctBidderIds: vi.fn().mockResolvedValue(["bidder-a"]),
    } as unknown as IBidRepository;

    const stageDispatch = vi.fn().mockResolvedValue(undefined);
    const notificationOutbox: INotificationOutboxService = { stageDispatch };

    const svc = new LotLifecycleService(
      createFactory(lots, bids),
      null,
      null,
      null,
      new NotificationFactory(),
      null,
      null,
      null,
      null,
      null,
      notificationOutbox,
    );

    await expect(svc.noSaleEndActiveLotFromClerk("a1")).resolves.toBe(true);
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

    const bids: IBidRepository = {
      findEligibleBidsForLotClose: vi
        .fn()
        .mockResolvedValue([bid({ amount: "500.00", buyerLegalEntityId: "le-1" })]),
      listForLotSettlement: vi
        .fn()
        .mockResolvedValue([bid({ amount: "500.00", buyerLegalEntityId: "le-1" })]),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["u1"]),
    } as unknown as IBidRepository;

    const svc = new LotLifecycleService(
      createFactory(lots, bids),
      null,
      null,
      null,
      new NotificationFactory(),
      null,
      null,
      null,
    );

    const outcome = await svc.finalizeActiveLotFromClerkHammer("a1");
    expect(outcome?.winnerId).toBeNull();
    expect(lots.setWinner).not.toHaveBeenCalled();
  });
});
