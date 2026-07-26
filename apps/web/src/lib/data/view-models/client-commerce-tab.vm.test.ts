import type { AdminUserBidRow } from "@/lib/data/http/admin.server";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  CLIENT_BID_CHANNEL_FILTERS,
  buildClientWonLotGridItems,
  filterClientBids,
  matchesClientBidChannel,
  presentClientBidStatus,
} from "./client-commerce-tab.vm";

const sampleBid = (overrides: Partial<AdminUserBidRow> = {}): AdminUserBidRow => ({
  id: "bid_1",
  lotId: "lot_1",
  lotTitle: "Lot #18",
  saleId: "sale_1",
  saleTitle: "Evening Sale",
  amount: "1000.00",
  isWinning: true,
  isAutoBid: false,
  placedVia: "web",
  createdAt: new Date("2026-06-14T12:00:00.000Z"),
  ...overrides,
});

describe("client bid tab view-model", () => {
  it("maps channel filters to placedVia values", () => {
    expect(CLIENT_BID_CHANNEL_FILTERS.map((f) => f.id)).toEqual([
      "all",
      "online",
      "room",
      "telephone",
    ]);
    expect(matchesClientBidChannel(sampleBid({ placedVia: "web" }), "online")).toBe(true);
    expect(matchesClientBidChannel(sampleBid({ placedVia: null }), "online")).toBe(true);
    expect(matchesClientBidChannel(sampleBid({ placedVia: "saleroom" }), "room")).toBe(true);
    expect(matchesClientBidChannel(sampleBid({ placedVia: "telephone" }), "telephone")).toBe(true);
    expect(matchesClientBidChannel(sampleBid({ placedVia: "absentee" }), "telephone")).toBe(true);
  });

  it("presents leading/outbid status from isWinning only", () => {
    expect(presentClientBidStatus(sampleBid({ isWinning: true }))).toEqual({
      label: "Leading",
      tone: "info",
    });
    expect(presentClientBidStatus(sampleBid({ isWinning: false }))).toEqual({
      label: "Outbid",
      tone: "neutral",
    });
  });

  it("filters by search and channel together", () => {
    const rows = [
      sampleBid({ id: "a", placedVia: "web", saleTitle: "Alpha" }),
      sampleBid({ id: "b", placedVia: "saleroom", saleTitle: "Beta" }),
    ];
    const filtered = filterClientBids(rows, { search: "beta", channel: "room" });
    expect(filtered.map((row) => row.id)).toEqual(["b"]);
  });

  it("builds won-lot cards with lot number title and Winning badge", () => {
    const lot = {
      id: "lot_1",
      saleId: "sale_1",
      lotNumber: 34444,
      title: "Contemporary Evening Sale",
      currentPrice: "45000",
      status: "sold",
      winnerId: "user_1",
    } as unknown as Lot;
    const items = buildClientWonLotGridItems([lot], () => null);
    expect(items[0]?.title).toBe("Lot#34444");
    expect(items[0]?.badge).toEqual({ label: "Winning", tone: "success" });
  });
});
