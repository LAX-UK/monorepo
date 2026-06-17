import {
  applyDisplayBidSummaryToSnapshot,
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
    },
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
