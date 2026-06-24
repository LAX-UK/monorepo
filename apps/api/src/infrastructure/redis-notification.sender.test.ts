import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { RedisNotificationSender } from "./redis-notification.sender.js";

function baseLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    title: "Test",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: "27000.00",
    buyNowPrice: null,
    currentPrice: "1101.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: new Date(),
    endTime: new Date(),
    status: "ended",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  };
}

describe("RedisNotificationSender.notifyLotEnded", () => {
  it("publishes enriched no-sale payload when reserve not met", async () => {
    const publish = vi.fn().mockResolvedValue(1);
    const sender = new RedisNotificationSender({ publish } as never);
    await sender.notifyLotEnded(baseLot(), null, { trigger: "timed", hadBids: true });
    expect(publish).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(publish.mock.calls[0]?.[1]));
    expect(payload).toMatchObject({
      type: "lot_ended",
      outcome: "no_sale",
      noSale: true,
      noSaleReason: "reserve_not_met",
      reserveMet: false,
      hadBids: true,
      trigger: "timed",
    });
  });

  it("publishes sold outcome when winner present", async () => {
    const publish = vi.fn().mockResolvedValue(1);
    const sender = new RedisNotificationSender({ publish } as never);
    await sender.notifyLotEnded(
      baseLot({ currentPrice: "28000.00" }),
      {
        id: "bid-1",
        lotId: "lot-1",
        placedByUserId: "u1",
        bidderId: "u1",
        buyerLegalEntityId: "le-1",
        amount: "28000.00",
        isWinning: true,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: new Date(),
      },
      { trigger: "clerk_hammer", hadBids: true },
    );
    const payload = JSON.parse(String(publish.mock.calls[0]?.[1]));
    expect(payload).toMatchObject({
      outcome: "sold",
      winnerId: "u1",
      reserveMet: true,
    });
    expect(payload.noSale).toBeUndefined();
  });

  it("uses clerk_passed reason for clerk no sale", async () => {
    const publish = vi.fn().mockResolvedValue(1);
    const sender = new RedisNotificationSender({ publish } as never);
    await sender.notifyLotEnded(baseLot(), null, {
      trigger: "clerk_no_sale",
      hadBids: true,
    });
    const payload = JSON.parse(String(publish.mock.calls[0]?.[1]));
    expect(payload.noSaleReason).toBe("clerk_passed");
  });
});
