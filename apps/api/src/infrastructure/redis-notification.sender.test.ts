import type { Bid, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { RedisNotificationSender } from "./redis-notification.sender.js";

function baseLot(overrides: Partial<Lot>): Lot {
  const now = new Date();
  return {
    id: "lot-1",
    saleId: null,
    lotNumber: 1,
    sellerId: "seller-1",
    title: "Test",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "5.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: now,
    status: "active",
    winnerId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const bid: Bid = {
  id: "bid-1",
  lotId: "lot-1",
  bidderId: "user-secret",
  amount: "500.00",
  isWinning: false,
  isAutoBid: false,
  maxAutoBidAmount: null,
  createdAt: new Date(),
};

describe("RedisNotificationSender", () => {
  it("redacts bid_placed payload for active sealed lots", async () => {
    const publish = vi.fn().mockResolvedValue(1);
    const sender = new RedisNotificationSender({ publish } as never);
    await sender.notifyBidPlaced(
      baseLot({ auctionType: "sealed", status: "active" }),
      bid,
    );
    expect(publish).toHaveBeenCalledTimes(1);
    const payload = publish.mock.calls[0]?.[1] as string;
    expect(payload).toContain('"sealed":true');
    expect(payload).not.toContain("user-secret");
    expect(payload).not.toContain("500.00");
    expect(payload).not.toContain('"bid"');
  });

  it("publishes full bid for non-sealed active lots", async () => {
    const publish = vi.fn().mockResolvedValue(1);
    const sender = new RedisNotificationSender({ publish } as never);
    await sender.notifyBidPlaced(baseLot({ auctionType: "english", status: "active" }), bid);
    const payload = publish.mock.calls[0]?.[1] as string;
    expect(payload).toContain('"bid"');
    expect(payload).toContain("user-secret");
  });
});
