import type { Bid, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { LotStrategyFactory } from "../strategies/strategy.factory.js";
import type { IBidRepository, ILotRepository } from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import { LotLifecycleService } from "./lot-lifecycle.service.js";
import { NotificationFactory } from "./notification.factory.js";

function bid(overrides: Partial<Bid> = {}): Bid {
  const now = new Date();
  return {
    id: "b1",
    lotId: "a1",
    bidderId: "u1",
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
    runInTransaction: async <T>(fn: (r: typeof root) => Promise<T>) => fn(root),
  };
}

describe("LotLifecycleService", () => {
  const strategyFactory = new LotStrategyFactory();

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
    } as unknown as ILotRepository;

    const bids: IBidRepository = {
      listForLotSettlement: vi.fn().mockResolvedValue([bid({ amount: "500.00" })]),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["u1"]),
    } as unknown as IBidRepository;

    const svc = new LotLifecycleService(
      createFactory(lots, bids),
      strategyFactory,
      null,
      null,
      null,
      new NotificationFactory(),
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
    } as unknown as ILotRepository;

    const bids: IBidRepository = {
      listForLotSettlement: vi
        .fn()
        .mockResolvedValue([bid({ amount: "500.00", bidderId: "winner" })]),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["winner"]),
    } as unknown as IBidRepository;

    const svc = new LotLifecycleService(
      createFactory(lots, bids),
      strategyFactory,
      null,
      null,
      null,
      new NotificationFactory(),
    );
    await svc.runTransitions(new Date());

    expect(lots.setWinner).toHaveBeenCalledWith("a1", "winner");
    expect(lots.updateStatus).toHaveBeenCalledWith("a1", "ended");
  });
});
