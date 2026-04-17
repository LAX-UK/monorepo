import type { Auction, Bid } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AuctionStrategyFactory } from "../strategies/strategy.factory.js";
import { AuctionLifecycleService } from "./auction-lifecycle.service.js";
import type { IAuctionRepository, IBidRepository } from "./interfaces/repositories.js";
import { NotificationFactory } from "./notification.factory.js";

function bid(overrides: Partial<Bid> = {}): Bid {
  const now = new Date();
  return {
    id: "b1",
    auctionId: "a1",
    bidderId: "u1",
    amount: "500.00",
    isWinning: true,
    isAutoBid: false,
    maxAutoBidAmount: null,
    createdAt: now,
    ...overrides,
  };
}

describe("AuctionLifecycleService", () => {
  const strategyFactory = new AuctionStrategyFactory();

  it("does not set winner when reserve is not met", async () => {
    const auction: Auction = {
      id: "a1",
      sellerId: "s1",
      title: "Lot",
      description: null,
      medium: null,
      dimensions: null,
      images: [],
      categoryId: null,
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
      startTime: new Date(),
      endTime: new Date(),
      status: "active",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const auctions: IAuctionRepository = {
      findScheduledToActivate: vi.fn().mockResolvedValue([]),
      findActivePastEnd: vi.fn().mockResolvedValue([auction]),
      findActiveByEndTimeBetween: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchAuctions: vi.fn().mockResolvedValue([]),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
    } as unknown as IAuctionRepository;

    const bids: IBidRepository = {
      listForAuctionSettlement: vi.fn().mockResolvedValue([bid({ amount: "500.00" })]),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["u1"]),
    } as unknown as IBidRepository;

    const svc = new AuctionLifecycleService(
      auctions,
      bids,
      strategyFactory,
      null,
      null,
      null,
      new NotificationFactory(),
    );
    await svc.runTransitions(new Date());

    expect(auctions.setWinner).not.toHaveBeenCalled();
    expect(auctions.updateStatus).toHaveBeenCalledWith("a1", "ended");
  });

  it("sets winner when reserve is met", async () => {
    const auction: Auction = {
      id: "a1",
      sellerId: "s1",
      title: "Lot",
      description: null,
      medium: null,
      dimensions: null,
      images: [],
      categoryId: null,
      auctionType: "english",
      startingPrice: "100.00",
      reservePrice: "400.00",
      buyNowPrice: null,
      currentPrice: "500.00",
      buyerPremiumRate: "0.25",
      minBidIncrement: "1.00",
      dutchDecrementAmount: null,
      dutchDecrementIntervalMs: 60_000,
      dutchLastDecrementAt: null,
      startTime: new Date(),
      endTime: new Date(),
      status: "active",
      winnerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const auctions: IAuctionRepository = {
      findScheduledToActivate: vi.fn().mockResolvedValue([]),
      findActivePastEnd: vi.fn().mockResolvedValue([auction]),
      findActiveByEndTimeBetween: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchAuctions: vi.fn().mockResolvedValue([]),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
    } as unknown as IAuctionRepository;

    const bids: IBidRepository = {
      listForAuctionSettlement: vi
        .fn()
        .mockResolvedValue([bid({ amount: "500.00", bidderId: "winner" })]),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["winner"]),
    } as unknown as IBidRepository;

    const svc = new AuctionLifecycleService(
      auctions,
      bids,
      strategyFactory,
      null,
      null,
      null,
      new NotificationFactory(),
    );
    await svc.runTransitions(new Date());

    expect(auctions.setWinner).toHaveBeenCalledWith("a1", "winner");
    expect(auctions.updateStatus).toHaveBeenCalledWith("a1", "ended");
  });
});
