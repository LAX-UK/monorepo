import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { LOT_BID_HISTORY_CAP } from "@/lib/bid/lot-bid-history-constants";
import {
  type LotBidHistoryState,
  reduceOnBidUpdate,
  reduceOnHydrate,
  reduceOnOwnBid,
} from "@/lib/bid/lot-bid-history-reducer";
import { describe, expect, it } from "vitest";

const baseState = (): LotBidHistoryState => ({
  entries: [],
  currentPrice: "100",
  leadingBidderId: null,
});

const entry = (id: string, amount: string, bidderId = "user-1"): BidHistoryEntry => ({
  id,
  bidderId,
  amount,
  at: Date.now(),
});

describe("reduceOnOwnBid", () => {
  it("prepends own bid and updates price and leader", () => {
    const next = reduceOnOwnBid(baseState(), {
      id: "bid-1",
      amount: "150",
      bidderId: "user-1",
      placedVia: "web",
    });
    expect(next.currentPrice).toBe("150");
    expect(next.leadingBidderId).toBe("user-1");
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0]?.id).toBe("bid-1");
    expect(next.entries[0]?.placedVia).toBe("web");
  });
});

describe("reduceOnBidUpdate", () => {
  it("appends history and updates price when not skipping leader", () => {
    const prev: LotBidHistoryState = {
      entries: [entry("bid-1", "100")],
      currentPrice: "100",
      leadingBidderId: "user-1",
    };
    const next = reduceOnBidUpdate(prev, {
      lotId: "lot-1",
      bidId: "bid-2",
      bidderId: "user-2",
      amount: "120",
      currentPrice: "120",
      placedVia: "web",
    });
    expect(next.entries.map((e) => e.id)).toEqual(["bid-2", "bid-1"]);
    expect(next.currentPrice).toBe("120");
    expect(next.leadingBidderId).toBe("user-2");
  });

  it("dedupes by bid id when echo arrives after own bid", () => {
    const prev: LotBidHistoryState = {
      entries: [entry("bid-1", "150")],
      currentPrice: "150",
      leadingBidderId: "user-1",
    };
    const next = reduceOnBidUpdate(
      prev,
      {
        lotId: "lot-1",
        bidId: "bid-1",
        bidderId: "user-1",
        amount: "150",
        currentPrice: "150",
      },
      { skipPriceLeader: true },
    );
    expect(next.entries).toHaveLength(1);
    expect(next.currentPrice).toBe("150");
    expect(next.leadingBidderId).toBe("user-1");
  });

  it("skips price and leader update when skipPriceLeader is set", () => {
    const prev: LotBidHistoryState = {
      entries: [],
      currentPrice: "150",
      leadingBidderId: "user-1",
    };
    const next = reduceOnBidUpdate(
      prev,
      {
        lotId: "lot-1",
        bidId: "bid-2",
        bidderId: "user-2",
        amount: "120",
        currentPrice: "120",
      },
      { skipPriceLeader: true },
    );
    expect(next.entries).toHaveLength(1);
    expect(next.currentPrice).toBe("150");
    expect(next.leadingBidderId).toBe("user-1");
  });
});

describe("reduceOnHydrate", () => {
  it("replaces state from server snapshot", () => {
    const prev: LotBidHistoryState = {
      entries: [entry("stale", "50")],
      currentPrice: "50",
      leadingBidderId: "user-old",
    };
    const serverEntries = [entry("bid-a", "200", "user-a"), entry("bid-b", "180", "user-b")];
    const next = reduceOnHydrate(prev, {
      currentPrice: "200",
      leadingBidderId: "user-a",
      entries: serverEntries,
    });
    expect(next.currentPrice).toBe("200");
    expect(next.leadingBidderId).toBe("user-a");
    expect(next.entries).toHaveLength(2);
  });

  it("caps history to LOT_BID_HISTORY_CAP", () => {
    const many = Array.from({ length: LOT_BID_HISTORY_CAP + 5 }, (_, i) =>
      entry(`bid-${i}`, String(100 + i)),
    );
    const next = reduceOnHydrate(baseState(), {
      currentPrice: "500",
      leadingBidderId: "user-1",
      entries: many,
    });
    expect(next.entries).toHaveLength(LOT_BID_HISTORY_CAP);
  });
});
