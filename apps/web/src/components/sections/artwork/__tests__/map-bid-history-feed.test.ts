import { mapBidHistoryToFeedEntries } from "@/components/sections/artwork/artwork-view-models";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { describe, expect, it } from "vitest";

describe("mapBidHistoryToFeedEntries", () => {
  it("preserves isAutoBid on the leading feed row", () => {
    const entries: BidHistoryEntry[] = [
      {
        id: "b1",
        bidderId: "u1",
        amount: "200",
        at: 2,
        isAutoBid: true,
      },
      {
        id: "b2",
        bidderId: "u2",
        amount: "150",
        at: 1,
      },
    ];
    const rows = mapBidHistoryToFeedEntries(entries, "u1");
    expect(rows[0]?.isAutoBid).toBe(true);
    expect(rows[0]?.isHighest).toBe(true);
  });
});
