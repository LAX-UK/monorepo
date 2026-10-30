import type { BidWithLot, WatchlistWithLotRow } from "@/lib/data/dto/dashboard-dtos";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { artistAlertSummary, parseArtistAlertDraft } from "./artist-alert";
import { savedSearchSummary } from "./saved-search";
import { buildWatchedLots, parseWatchingView, watchedLotsInView } from "./watching.vm";

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

describe("buildWatchedLots", () => {
  const open = lot("open");
  const upcoming = lot("soon", {
    status: "scheduled",
    startTime: new Date("2026-11-20T10:00:00Z"),
    endTime: new Date("2026-11-20T18:00:00Z"),
  });
  const sold = lot("sold", {
    status: "ended",
    winnerId: "someone",
    endTime: new Date("2026-10-30T18:00:00Z"),
  });

  it("says where the person stands, the figure that matters and when", () => {
    const rows = buildWatchedLots({
      rows: [watched(open), watched(upcoming), watched(sold)],
      bids: [myBid(open)],
      userId: "me",
      now: NOW,
    });
    expect(rows.map((row) => [row.standing.label, row.figure.label, row.moment])).toEqual([
      ["Winning", "current bid", "closes Today 15:00"],
      ["Not bidding", "estimate", "opens 20 Nov"],
      ["Sold", "sold for", "closed 30 Oct"],
    ]);
    expect(rows[1]?.figure.value).toBe("£2,000.00 – £3,000.00");
  });

  it("puts open lots first, soonest to close, and ended ones last", () => {
    const rows = buildWatchedLots({
      rows: [watched(sold), watched(upcoming), watched(open)],
      bids: [],
      userId: "me",
      now: NOW,
    });
    expect(watchedLotsInView(rows, "", "closing").map((row) => row.lotId)).toEqual([
      "open",
      "soon",
      "sold",
    ]);
    expect(watchedLotsInView(rows, "work sold", "closing").map((row) => row.lotId)).toEqual([
      "sold",
    ]);
  });

  it("opens Lots unless another view is asked for", () => {
    expect(parseWatchingView("artists")).toBe("artists");
    expect(parseWatchingView("upcoming")).toBe("lots");
    expect(parseWatchingView(undefined)).toBe("lots");
  });
});

describe("artist alerts", () => {
  it("summarises the criteria in a few words", () => {
    expect(artistAlertSummary({ medium: null, priceMin: null, priceMax: null })).toBe(
      "Every new work",
    );
    expect(artistAlertSummary({ medium: "oil", priceMin: "2000.00", priceMax: null })).toBe(
      "Oil · £2,000 and up",
    );
    expect(artistAlertSummary({ medium: null, priceMin: "2000", priceMax: "10000" })).toBe(
      "£2,000 to £10,000",
    );
  });

  it("reads amounts as typed, and refuses a range that runs backwards", () => {
    expect(parseArtistAlertDraft({ medium: " oil ", priceMin: "£2,000", priceMax: "" })).toEqual({
      ok: true,
      criteria: { medium: "oil", priceMin: "2000", priceMax: null },
    });
    expect(parseArtistAlertDraft({ medium: "", priceMin: "abc", priceMax: "" })).toMatchObject({
      ok: false,
      errors: { priceMin: expect.any(String) },
    });
    expect(parseArtistAlertDraft({ medium: "", priceMin: "5000", priceMax: "2000" })).toMatchObject(
      { ok: false, errors: { priceMax: expect.any(String) } },
    );
  });
});

describe("saved searches", () => {
  it("say what they look for without the catalogue's own keys", () => {
    expect(savedSearchSummary({ q: "hepworth", category: "sculpture" })).toBe(
      "“hepworth” with 1 filter",
    );
    expect(savedSearchSummary({})).toBe("The whole catalogue");
  });
});
