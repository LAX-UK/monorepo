import {
  applyDisplayBidSummaryToSnapshot,
  buildDisplayBoardVM,
  computeNextRequiredBid,
  formatDisplayEstimate,
  resolveBidSummaryAfterFullHydrate,
} from "@/features/saleroom/lib/display-bid-ticks";
import type { SaleroomDisplaySnapshot } from "@auction/types";
import { describe, expect, it } from "vitest";

function snapshot(currentPrice = "100.00", bidCount = 1): SaleroomDisplaySnapshot {
  return {
    saleId: "sale-1",
    saleTitle: "Room A",
    sessionStatus: "live",
    currentLotId: "lot-1",
    currentLot: {
      id: "lot-1",
      lotNumber: 1,
      title: "Lot one",
      imageUrl: null,
      currentPrice,
      bidCount,
      leaderPaddleNumber: 205,
      estimate: { low: "80.00", high: "120.00", currency: "GBP" },
      minBidIncrement: "10.00",
    },
    nextLot: null,
    saleProgress: { position: 1, total: 3 },
    saleCoverImageUrl: null,
    sessionStartedAt: "2026-06-17T14:00:00.000Z",
    overlay: null,
  };
}

describe("display bid summary helpers", () => {
  it("updates current lot price from display bid summary", () => {
    const next = applyDisplayBidSummaryToSnapshot(snapshot(), {
      lotId: "lot-1",
      currentPrice: "175.00",
      bidCount: 3,
      leaderPaddleNumber: 210,
    });
    expect(next.currentLot?.currentPrice).toBe("175.00");
    expect(next.currentLot?.bidCount).toBe(3);
    expect(next.currentLot?.leaderPaddleNumber).toBe(210);
  });

  it("prefers live display bid summary over stale snapshot hydrate", () => {
    const live = snapshot("175.00", 3);
    const stale = snapshot("100.00", 1);
    const resolved = resolveBidSummaryAfterFullHydrate(live, stale, "2026-06-17T10:00:00.000Z");
    expect(resolved.currentLot?.currentPrice).toBe("175.00");
    expect(resolved.currentLot?.bidCount).toBe(3);
  });
});

describe("display board helpers", () => {
  it("formats estimate ranges", () => {
    expect(formatDisplayEstimate({ low: "1000.00", high: "1500.00", currency: "GBP" })).toContain(
      "1,000",
    );
  });

  it("computes next required bid", () => {
    expect(computeNextRequiredBid("500.00", "25.00")).toBe("525.00");
    expect(computeNextRequiredBid("bad", "25.00")).toBeNull();
  });

  it("builds board vm with next required bid", () => {
    const vm = buildDisplayBoardVM(
      snapshot(),
      {
        recentBids: [],
        priceFlash: false,
        leaderPlacedVia: "saleroom",
      },
      "connected",
    );
    expect(vm.nextRequiredBid).toBe("110.00");
    expect(vm.nextRequiredBidCurrency).toBe("GBP");
    expect(vm.leaderLabel).toBe("Paddle 205");
  });
});
