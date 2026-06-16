import type { BidUpdateEvent, SaleroomDisplaySnapshot } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  DISPLAY_BID_TICK_CAP,
  applyDisplayBidUpdate,
  buildDisplayBoardVM,
  formatDisplayBidRowLabel,
  formatDisplayLeaderLabel,
  mergeSnapshotAfterHydrate,
  resetDisplayBidLiveState,
} from "./display-bid-ticks";

function bidEvent(overrides: Partial<BidUpdateEvent> = {}): BidUpdateEvent {
  return {
    lotId: "lot-1",
    bidId: "bid-1",
    bidderId: "user-1",
    amount: "100.00",
    currentPrice: "100.00",
    placedVia: "saleroom",
    ...overrides,
  };
}

function snapshot(overrides: Partial<SaleroomDisplaySnapshot> = {}): SaleroomDisplaySnapshot {
  return {
    saleId: "sale-1",
    saleTitle: "Test sale",
    sessionStatus: "live",
    currentLotId: "lot-1",
    currentLot: {
      id: "lot-1",
      lotNumber: 1,
      title: "Lot one",
      imageUrl: null,
      currentPrice: "100.00",
      bidCount: 1,
      leaderPaddleNumber: 205,
    },
    overlay: null,
    ...overrides,
  };
}

describe("formatDisplayLeaderLabel", () => {
  it("prefers channel over stale paddle for online bids", () => {
    expect(formatDisplayLeaderLabel("web", 205)).toBe("Online");
    expect(formatDisplayLeaderLabel("telephone", 142)).toBe("Telephone");
  });

  it("shows paddle for floor bids when known", () => {
    expect(formatDisplayLeaderLabel("saleroom", 205)).toBe("Paddle 205");
    expect(formatDisplayLeaderLabel("saleroom", null)).toBe("Floor");
  });

  it("falls back to paddle when channel is unknown", () => {
    expect(formatDisplayLeaderLabel(null, 205)).toBe("Paddle 205");
  });

  it("returns null when no paddle or channel", () => {
    expect(formatDisplayLeaderLabel(null, null)).toBeNull();
  });
});

describe("formatDisplayBidRowLabel", () => {
  it("uses leader label logic with bidder fallback", () => {
    expect(formatDisplayBidRowLabel("telephone", 142)).toBe("Telephone");
    expect(formatDisplayBidRowLabel("saleroom", 142)).toBe("Paddle 142");
    expect(formatDisplayBidRowLabel("web", null)).toBe("Online");
    expect(formatDisplayBidRowLabel(null, null)).toBe("Bidder");
  });
});

describe("applyDisplayBidUpdate", () => {
  it("prepends a tick and sets priceFlash", () => {
    const next = applyDisplayBidUpdate(resetDisplayBidLiveState(), bidEvent(), {
      lotId: "lot-1",
    });
    expect(next.recentBids).toHaveLength(1);
    expect(next.recentBids[0]?.id).toBe("bid-1");
    expect(next.priceFlash).toBe(true);
    expect(next.leaderPlacedVia).toBe("saleroom");
  });

  it("ignores events for other lots", () => {
    const initial = resetDisplayBidLiveState();
    const next = applyDisplayBidUpdate(initial, bidEvent({ lotId: "lot-2" }), {
      lotId: "lot-1",
    });
    expect(next).toBe(initial);
  });

  it("dedupes by bid id and caps feed length", () => {
    let state = resetDisplayBidLiveState();
    for (let i = 0; i < DISPLAY_BID_TICK_CAP + 2; i++) {
      state = applyDisplayBidUpdate(
        state,
        bidEvent({ bidId: `bid-${i}`, amount: `${100 + i}.00` }),
        { lotId: "lot-1" },
      );
    }
    expect(state.recentBids).toHaveLength(DISPLAY_BID_TICK_CAP);

    state = applyDisplayBidUpdate(state, bidEvent({ bidId: "bid-3", amount: "999.00" }), {
      lotId: "lot-1",
    });
    expect(state.recentBids).toHaveLength(DISPLAY_BID_TICK_CAP);
    expect(state.recentBids[0]?.id).toBe("bid-3");
    expect(state.recentBids.filter((tick) => tick.id === "bid-3")).toHaveLength(1);
  });

  it("can suppress price flash during sold/passed overlay", () => {
    const next = applyDisplayBidUpdate(resetDisplayBidLiveState(), bidEvent(), {
      lotId: "lot-1",
      suppressFlash: true,
    });
    expect(next.priceFlash).toBe(false);
  });
});

describe("mergeSnapshotAfterHydrate", () => {
  it("preserves bid live state when lot id is unchanged", () => {
    const live = applyDisplayBidUpdate(resetDisplayBidLiveState(), bidEvent(), {
      lotId: "lot-1",
    });
    expect(mergeSnapshotAfterHydrate(live, "lot-1", "lot-1")).toBe(live);
  });

  it("resets bid live state when lot changes", () => {
    const live = applyDisplayBidUpdate(resetDisplayBidLiveState(), bidEvent(), {
      lotId: "lot-1",
    });
    const next = mergeSnapshotAfterHydrate(live, "lot-1", "lot-2");
    expect(next.recentBids).toHaveLength(0);
    expect(next.priceFlash).toBe(false);
  });
});

describe("buildDisplayBoardVM", () => {
  it("builds leader label from paddle when bids exist", () => {
    const live = applyDisplayBidUpdate(resetDisplayBidLiveState(), bidEvent(), {
      lotId: "lot-1",
    });
    const vm = buildDisplayBoardVM(snapshot(), live, "connected");
    expect(vm.leaderLabel).toBe("Paddle 205");
    expect(vm.priceFlash).toBe(true);
  });

  it("uses channel label when paddle is unknown but bids exist", () => {
    const live = applyDisplayBidUpdate(resetDisplayBidLiveState(), bidEvent({ placedVia: "web" }), {
      lotId: "lot-1",
    });
    const vm = buildDisplayBoardVM(
      snapshot({
        currentLot: {
          id: "lot-1",
          lotNumber: 1,
          title: "Lot one",
          imageUrl: null,
          currentPrice: "100.00",
          bidCount: 2,
          leaderPaddleNumber: null,
        },
      }),
      live,
      "connected",
    );
    expect(vm.leaderLabel).toBe("Online");
  });

  it("prefers online channel over stale paddle from snapshot", () => {
    const live = applyDisplayBidUpdate(resetDisplayBidLiveState(), bidEvent({ placedVia: "web" }), {
      lotId: "lot-1",
    });
    const vm = buildDisplayBoardVM(snapshot(), live, "connected");
    expect(vm.leaderLabel).toBe("Online");
  });

  it("hides leader label when there are no bids", () => {
    const vm = buildDisplayBoardVM(
      snapshot({
        currentLot: {
          id: "lot-1",
          lotNumber: 1,
          title: "Lot one",
          imageUrl: null,
          currentPrice: "50.00",
          bidCount: 0,
          leaderPaddleNumber: null,
        },
      }),
      resetDisplayBidLiveState(),
      "connected",
    );
    expect(vm.leaderLabel).toBeNull();
  });

  it("suppresses price flash when sold/passed overlay is active", () => {
    const live = applyDisplayBidUpdate(resetDisplayBidLiveState(), bidEvent(), {
      lotId: "lot-1",
    });
    const vm = buildDisplayBoardVM(snapshot(), live, "connected", {
      suppressPriceFlash: true,
    });
    expect(vm.priceFlash).toBe(false);
  });
});
