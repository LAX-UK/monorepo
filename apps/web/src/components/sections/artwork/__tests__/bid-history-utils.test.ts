import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { prependBidHistoryEntry } from "@/components/sections/artwork/bid-history-utils";
import { describe, expect, it } from "vitest";

describe("prependBidHistoryEntry", () => {
  it("prepends and dedupes by id", () => {
    const prev: BidHistoryEntry[] = [
      { id: "a", bidderId: "u1", amount: "100", at: 1 },
      { id: "b", bidderId: "u2", amount: "110", at: 2 },
    ];
    const next = prependBidHistoryEntry(prev, {
      id: "b",
      bidderId: "u2",
      amount: "120",
      isAutoBid: true,
    });
    expect(next).toHaveLength(2);
    expect(next[0]?.id).toBe("b");
    expect(next[0]?.amount).toBe("120");
    expect(next[0]?.isAutoBid).toBe(true);
    expect(next[1]?.id).toBe("a");
  });
});
