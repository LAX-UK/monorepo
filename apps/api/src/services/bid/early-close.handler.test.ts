import type { Database } from "@auction/db";
import type { Bid, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { BuyItNowAuctionStrategy } from "../../strategies/buy-it-now.strategy.js";
import { DutchAuctionStrategy } from "../../strategies/dutch.strategy.js";
import type { ILotRepository } from "../interfaces/repositories.js";
import type { LotLifecycleRecording } from "../lot-lifecycle-recording.service.js";
import { EarlyCloseHandler } from "./early-close.handler.js";

const CAT = "c1000001-0000-4000-8000-000000000001";

function mkLot(overrides: Partial<Lot> = {}): Lot {
  const now = new Date();
  return {
    id: "lot-1",
    saleId: null,
    lotNumber: null,
    sellerId: "seller-1",
    sellerLegalEntityId: "seller-le",
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: CAT,
    auctionType: "buy_it_now",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: "500.00",
    currentPrice: "100.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: new Date(now.getTime() + 86_400_000),
    status: "active",
    winnerId: null,
    voidedReason: null,
    archivedSeller: false,
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
    ...overrides,
  };
}

function mkBid(overrides: Partial<Bid> = {}): Bid {
  const now = new Date();
  return {
    id: "bid-1",
    lotId: "lot-1",
    bidderId: "buyer-1",
    placedByUserId: "buyer-1",
    buyerLegalEntityId: "buyer-le",
    amount: "500.00",
    isWinning: false,
    isAutoBid: false,
    maxAutoBidAmount: null,
    createdAt: now,
    ...overrides,
  };
}

describe("EarlyCloseHandler", () => {
  it("ends buy-it-now lot early and records lifecycle", async () => {
    const lotRow = mkLot();
    const lastBid = mkBid();
    const setWinner = vi.fn();
    const updateStatus = vi.fn();
    const recordEnded = vi.fn();
    const lots = { setWinner, updateStatus } as unknown as ILotRepository;
    const recording = { recordEnded } as unknown as LotLifecycleRecording;
    const handler = new EarlyCloseHandler(recording);
    const strategy = new BuyItNowAuctionStrategy();

    const result = await handler.tryEarlyClose({
      strategy,
      lots,
      lotRow,
      lastBid,
      buyerLegalEntityId: "buyer-le",
      placedByUserId: "buyer-1",
      tx: {} as Database,
    });

    expect(result).toEqual({
      endedEarly: true,
      winnerUserId: "buyer-1",
      winnerLegalEntityId: "buyer-le",
      hammerPrice: "500.00",
    });
    expect(setWinner).toHaveBeenCalledWith("lot-1", "buyer-1", "buyer-le");
    expect(updateStatus).toHaveBeenCalledWith("lot-1", "ended");
    expect(recordEnded).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({ trigger: "early_close", outcome: "sold" }),
      }),
    );
  });

  it("ends dutch lot on price acceptance", async () => {
    const lotRow = mkLot({ auctionType: "dutch", currentPrice: "150.00", buyNowPrice: null });
    const lastBid = mkBid({ amount: "150.00" });
    const setWinner = vi.fn();
    const updateStatus = vi.fn();
    const lots = { setWinner, updateStatus } as unknown as ILotRepository;
    const handler = new EarlyCloseHandler(null);
    const strategy = new DutchAuctionStrategy();

    const result = await handler.tryEarlyClose({
      strategy,
      lots,
      lotRow,
      lastBid,
      buyerLegalEntityId: "buyer-le",
      placedByUserId: "buyer-1",
      tx: {} as Database,
    });

    expect(result?.endedEarly).toBe(true);
    expect(result?.hammerPrice).toBe("150.00");
    expect(setWinner).toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalledWith("lot-1", "ended");
  });
});
