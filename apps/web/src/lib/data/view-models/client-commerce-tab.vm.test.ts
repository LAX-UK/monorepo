import type { AdminUserBidRow } from "@/lib/data/http/admin.server";
import { describe, expect, it } from "vitest";
import {
  CLIENT_BID_CHANNEL_OPTIONS,
  clientBidChannelLabel,
  decimalToMinorUnits,
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
    expect(CLIENT_BID_CHANNEL_OPTIONS.map((f) => f.value)).toEqual([
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

  it("names the channel in words, never the stored value", () => {
    expect(clientBidChannelLabel("web")).toBe("Online");
    expect(clientBidChannelLabel(null)).toBe("Online");
    expect(clientBidChannelLabel("saleroom")).toBe("In the room");
    expect(clientBidChannelLabel("phone_in")).toBe("Phone in");
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

  it("turns a decimal amount in pounds into minor units", () => {
    expect(decimalToMinorUnits("1250.50")).toBe(125050);
    expect(decimalToMinorUnits("45000")).toBe(4500000);
    expect(decimalToMinorUnits("")).toBeNull();
    expect(decimalToMinorUnits("n/a")).toBeNull();
  });
});
