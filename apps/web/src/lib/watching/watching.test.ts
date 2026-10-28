import type { BidWithLot, WatchlistWithLotRow } from "@/lib/data/dto/dashboard-dtos";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildWatchingVm, parseWatchingTab } from "./watching.vm";

const NOW = new Date("2026-11-02T12:00:00.000Z");

function lot(id: string, overrides: Partial<Lot> = {}): Lot {
  return {
    id,
    saleId: "sale-3",
    lotNumber: 22,
    title: `Work ${id}`,
    images: [],
    startingPrice: "250",
    currentPrice: "2600",
    status: "active",
    startTime: new Date("2026-11-01T10:00:00Z"),
    endTime: new Date("2026-11-02T15:00:00Z"),
    winnerId: null,
    marketingDetails: { estimate: { low: "2000", high: "3000", currency: "GBP" } },
    ...overrides,
  } as Lot;
}

function watched(l: Lot): WatchlistWithLotRow {
  return { watchlistId: `w-${l.id}`, lotId: l.id, createdAt: NOW, lot: l };
}

function myBid(l: Lot, overrides: Partial<BidWithLot["bid"]> = {}): BidWithLot {
  return {
    bid: {
      id: `b-${l.id}`,
      lotId: l.id,
      amount: "2600",
      isWinning: true,
      isAutoBid: false,
      maxAutoBidAmount: null,
      createdAt: NOW,
      ...overrides,
    },
    lot: l,
  };
}

describe("buildWatchingVm", () => {
  const live = lot("live");
  const soon = lot("soon", { endTime: new Date("2026-11-02T12:40:00Z"), saleId: "sale-4" });
  const upcoming = lot("up", { status: "scheduled", startTime: new Date("2026-11-06T14:00:00Z") });
  const sold = lot("sold", { status: "ended", hasWinner: true, currentPrice: "900" });
  const rows = [live, soon, upcoming, sold].map(watched);

  it("opens Live while something is live and counts each view", () => {
    const vm = buildWatchingVm({ rows, bids: [], userId: "me", tab: null, now: NOW });
    expect(vm.tab).toBe("live");
    expect(vm.tabs.map((tab) => tab.count)).toEqual([1, 2, 1]);
    expect(vm.summary).toBe("2 lots in 2 sales");
  });

  it("puts the person's own bid on the pill before the lot's moment", () => {
    const vm = buildWatchingVm({
      rows,
      bids: [myBid(live)],
      userId: "me",
      tab: "live",
      now: NOW,
    });
    expect(vm.cards.map((card) => card.badgeLabel)).toEqual(["You're winning", "Closing soon"]);
    expect(vm.cards[0]).toMatchObject({
      figure: "£2,600.00",
      estimate: "Estimate £2,000.00 – £3,000.00",
      timing: { kind: "countdown", endsAt: "2026-11-02T15:00:00.000Z" },
    });
  });

  it("shows an absentee bid, the opening price and the date on upcoming lots", () => {
    const withBid = buildWatchingVm({
      rows,
      bids: [myBid(upcoming, { amount: "18000" })],
      userId: "me",
      tab: "upcoming",
      now: NOW,
    });
    expect(withBid.cards[0]).toMatchObject({
      badgeLabel: "Absentee bid",
      figure: "Absentee £18,000.00",
      timing: { kind: "date", label: "6 Nov" },
    });
    const plain = buildWatchingVm({ rows, bids: [], userId: "me", tab: "upcoming", now: NOW });
    expect(plain.cards[0]).toMatchObject({ badgeLabel: "Upcoming", figure: "Opens at £250.00" });
  });

  it("says how an ended lot closed", () => {
    const vm = buildWatchingVm({ rows, bids: [], userId: "me", tab: "ended", now: NOW });
    expect(vm.cards[0]).toMatchObject({ badgeLabel: "Sold", figure: "Sold for £900.00" });
  });

  it("reads an unknown view as none chosen", () => {
    expect(parseWatchingTab("live")).toBe("live");
    expect(parseWatchingTab("artists")).toBeNull();
  });
});
