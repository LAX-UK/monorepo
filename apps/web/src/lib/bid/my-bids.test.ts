import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { myBidActions } from "./my-bid-next-action";
import { groupMyBids, latestBidPerLot, myBidStatus, parseMyBidTab } from "./my-bid-status";
import { buildMyBidsVm } from "./my-bids.vm";

const NOW = new Date("2026-11-02T12:00:00.000Z");

function lot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-14",
    saleId: "sale-3",
    lotNumber: 14,
    title: "Still life with stoneware jug",
    description: null,
    medium: "Oil on canvas",
    dimensions: "61 × 50 cm",
    images: ["/img/jug.jpg"],
    categoryId: "",
    auctionType: "english",
    startingPrice: "1000",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "4200",
    buyerPremiumRate: "0.25",
    minBidIncrement: "200",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-11-01T10:00:00.000Z"),
    endTime: new Date("2026-11-02T12:04:12.000Z"),
    status: "active",
    winnerId: null,
    marketingDetails: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function bid(
  lotOverrides: Partial<Lot> | null,
  bidOverrides: Partial<BidWithLot["bid"]> = {},
): BidWithLot {
  const l = lotOverrides === null ? null : lot(lotOverrides);
  return {
    bid: {
      id: `bid-${l?.id ?? "gone"}-${bidOverrides.amount ?? "4000"}`,
      lotId: l?.id ?? "gone",
      amount: "4000",
      isWinning: false,
      isAutoBid: false,
      maxAutoBidAmount: null,
      placedByUserId: "user-1",
      createdAt: new Date("2026-11-02T11:00:00.000Z"),
      ...bidOverrides,
    },
    lot: l,
  };
}

describe("myBidStatus", () => {
  it("is winning only while the person's bid is the current price", () => {
    expect(myBidStatus(bid({ currentPrice: "4000" }, { isWinning: true }), "user-1")).toBe(
      "winning",
    );
    expect(myBidStatus(bid({ currentPrice: "4200" }, { isWinning: true }), "user-1")).toBe(
      "outbid",
    );
    expect(myBidStatus(bid({}), "user-1")).toBe("outbid");
  });

  it("holds a bid on a lot that has not opened as a maximum, or an absentee bid left with us", () => {
    expect(myBidStatus(bid({ status: "scheduled" }), "user-1")).toBe("maximum-set");
    expect(myBidStatus(bid({ status: "scheduled" }, { placedVia: "absentee" }), "user-1")).toBe(
      "absentee",
    );
  });

  it("knows a win by the person or by the account they bid for", () => {
    expect(myBidStatus(bid({ status: "ended", winnerId: "user-1" }), "user-1")).toBe("won");
    expect(
      myBidStatus(
        bid({ status: "ended", winnerId: "user-2", buyerLegalEntityId: "org-1" }),
        "user-1",
      ),
    ).toBe("not-won");
    expect(
      myBidStatus(
        bid(
          { status: "ended", winnerId: "user-2", buyerLegalEntityId: "org-1" },
          { buyerLegalEntityId: "org-1" },
        ),
        "user-1",
      ),
    ).toBe("won");
  });

  it("calls a cancelled or missing lot withdrawn", () => {
    expect(myBidStatus(bid({ status: "cancelled" }), "user-1")).toBe("withdrawn");
    expect(myBidStatus(bid(null), "user-1")).toBe("withdrawn");
  });
});

describe("groupMyBids", () => {
  it("keeps only the latest bid on each lot", () => {
    const older = bid({}, { amount: "3000", createdAt: new Date("2026-11-01T09:00:00Z") });
    const newer = bid({}, { amount: "4000" });
    expect(latestBidPerLot([newer, older])).toEqual([newer]);
  });

  it("puts outbid lots first, then winning, then absentee, each soonest to close", () => {
    const groups = groupMyBids(
      [
        bid({ id: "a", status: "scheduled", endTime: new Date("2026-11-06T14:00:00Z") }),
        bid(
          { id: "w", currentPrice: "4000", endTime: new Date("2026-11-02T13:00:00Z") },
          { isWinning: true },
        ),
        bid({ id: "o2", endTime: new Date("2026-11-03T12:00:00Z") }),
        bid({ id: "o1", endTime: new Date("2026-11-02T12:30:00Z") }),
        bid({ id: "x", status: "ended", winnerId: "user-1" }),
        bid({ id: "y", status: "ended", winnerId: "user-9" }),
      ],
      "user-1",
    );
    expect(groups.active.map((entry) => entry.row.lot?.id)).toEqual(["o1", "o2", "w", "a"]);
    expect(groups.won.map((entry) => entry.row.lot?.id)).toEqual(["x"]);
    expect(groups.lost.map((entry) => entry.row.lot?.id)).toEqual(["y"]);
  });

  it("reads an unknown view as Active", () => {
    expect(parseMyBidTab("won")).toBe("won");
    expect(parseMyBidTab("everything")).toBe("active");
    expect(parseMyBidTab(undefined)).toBe("active");
  });
});

describe("myBidActions", () => {
  it("offers the next bid as the one primary step on an outbid lot", () => {
    const actions = myBidActions("outbid", lot());
    expect(actions.map((a) => [a.label, a.emphasis])).toEqual([
      ["Set maximum", "secondary"],
      ["Bid £4,400.00", "primary"],
    ]);
    // The step opens the lot page, where the amount is confirmed; a row never places a bid.
    expect(actions.every((a) => a.href.startsWith("/lot/"))).toBe(true);
  });

  it("offers one quiet step otherwise, and nothing once the lot is lost", () => {
    expect(myBidActions("winning", lot()).map((a) => a.label)).toEqual(["Raise maximum"]);
    expect(myBidActions("maximum-set", lot()).map((a) => a.label)).toEqual(["Edit maximum"]);
    expect(myBidActions("absentee", lot())).toEqual([]);
    expect(myBidActions("won", lot())).toEqual([
      { kind: "view-purchase", label: "View purchase", href: "/purchases", emphasis: "secondary" },
    ]);
    expect(myBidActions("not-won", lot())).toEqual([]);
    expect(myBidActions("outbid", null)).toEqual([]);
  });
});

describe("buildMyBidsVm", () => {
  const rows = [
    bid({ id: "o1" }, { maxAutoBidAmount: "4000" }),
    bid({ id: "a", status: "scheduled", currentPrice: "1000" }, { amount: "18000" }),
    bid({ id: "x", status: "ended", winnerId: "user-1" }),
  ];

  it("builds every view at once, with the open lots to follow live", () => {
    const vm = buildMyBidsVm({
      rows,
      userId: "user-1",
      saleTitleById: { "sale-3": "Autumn modern and contemporary" },
      now: NOW,
    });
    expect(vm.cardsByTab.active.map((card) => card.statusLabel)).toEqual(["Outbid", "Maximum set"]);
    expect(vm.cardsByTab.won).toHaveLength(1);
    expect(vm.cardsByTab.lost).toHaveLength(0);
    expect(vm.sales).toEqual([{ id: "sale-3", title: "Autumn modern and contemporary" }]);
    expect(vm.liveLots).toEqual([
      { lotId: "o1", lotLabel: "14", title: "Still life with stoneware jug" },
    ]);
  });

  it("shows an open lot's price, the maximum and when it closes, with one next step", () => {
    const [card] = buildMyBidsVm({ rows, userId: "user-1", now: NOW }).cardsByTab.active;
    expect(card).toMatchObject({
      lotLabel: "Lot 14",
      figures: [
        { label: "current bid", value: "£4,200.00" },
        { label: "your maximum", value: "£4,000.00" },
        { label: "closes", value: "Today 12:04" },
      ],
    });
    expect(card?.next?.label).toBe("Bid £4,400.00");
    expect(card?.more.map((action) => action.label)).toEqual(["Set maximum"]);
  });

  it("shows a maximum waiting for the sale with no current bid yet", () => {
    const card = buildMyBidsVm({ rows, userId: "user-1", now: NOW }).cardsByTab.active[1];
    expect(card?.figures.map((f) => [f.label, f.value])).toEqual([
      ["current bid", "–"],
      ["your maximum", "£18,000.00"],
      ["sale day", "Yesterday"],
    ]);
  });

  it("names who placed each bid only on a shared list", () => {
    const placed = [{ ...bid({ id: "o1" }), placedBy: { userId: "u-2", name: "Tom Whitfield" } }];
    const shared = buildMyBidsVm({ rows: placed, userId: "user-1", showPlacedBy: true, now: NOW });
    expect(shared.cardsByTab.active[0]?.placedBy).toBe("Tom Whitfield");
    expect(shared.placers).toEqual(["Tom Whitfield"]);
    const own = buildMyBidsVm({ rows: placed, userId: "user-1", now: NOW });
    expect(own.cardsByTab.active[0]?.placedBy).toBeNull();
  });

  it("names a withdrawn lot instead of showing an empty row", () => {
    const vm = buildMyBidsVm({ rows: [bid(null)], userId: "user-1", now: NOW });
    expect(vm.cardsByTab.lost[0]).toMatchObject({
      href: null,
      title: "Lot withdrawn from the sale",
      figures: [],
      next: null,
    });
  });
});
