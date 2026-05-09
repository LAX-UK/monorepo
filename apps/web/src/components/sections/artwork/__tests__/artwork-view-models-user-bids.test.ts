import { mapUserBidsHistoryVM } from "@/components/sections/artwork/artwork-view-models";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { describe, expect, it } from "vitest";

const uid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const other = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

function entry(id: string, bidderId: string, amount: string, at: number): BidHistoryEntry {
  return { id, bidderId, amount, at };
}

describe("mapUserBidsHistoryVM", () => {
  it("returns null when no user id", () => {
    expect(mapUserBidsHistoryVM([], null, { status: "active", winnerId: null })).toBeNull();
  });

  it("returns null when user has no bids", () => {
    const rows = [entry("1", other, "100.00", 1)];
    expect(mapUserBidsHistoryVM(rows, uid, { status: "active", winnerId: null })).toBeNull();
  });

  it("marks leading active bid as highest", () => {
    const rows = [
      entry("1", uid, "500.00", 3),
      entry("2", other, "400.00", 2),
      entry("3", uid, "300.00", 1),
    ];
    const vm = mapUserBidsHistoryVM(rows, uid, { status: "active", winnerId: null });
    expect(vm?.count).toBe(2);
    expect(vm?.rows[0]?.id).toBe("1");
    expect(vm?.rows[0]?.status).toBe("highest");
    expect(vm?.rows[1]?.status).toBe("outbid");
    expect(vm?.paddleLabel).toMatch(/Paddle#/);
  });

  it("marks won when lot ended and user is winner on top bid", () => {
    const rows = [entry("1", uid, "500.00", 1), entry("2", other, "400.00", 2)];
    const vm = mapUserBidsHistoryVM(rows, uid, { status: "ended", winnerId: uid });
    expect(vm?.rows[0]?.status).toBe("won");
  });

  it("marks outbid when another bidder is ahead", () => {
    const rows = [entry("1", other, "900.00", 2), entry("2", uid, "100.00", 1)];
    const vm = mapUserBidsHistoryVM(rows, uid, { status: "active", winnerId: null });
    expect(vm?.rows[0]?.status).toBe("outbid");
  });
});
