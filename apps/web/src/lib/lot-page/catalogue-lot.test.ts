import { withoutLiveBidState } from "@/lib/lot-page/catalogue-lot";
import { toLotTemplateData } from "@/lib/lot-page/lot-template-props";
import { lotProductJsonLd } from "@/lib/seo/jsonld/lot";
import type { PublicLotView } from "@auction/types";
import { describe, expect, it } from "vitest";

/*
 * CO-7: what the lot page hands the browser is built from cached reads, so it carries none of the
 * lot's live bid state. These pin the three places a lot leaves the server: the bid entry's lot,
 * the template's lot and the structured data.
 */

const LIVE = {
  id: "lot-1",
  saleId: "sale-1",
  lotNumber: 4,
  title: "A painting",
  description: null,
  images: [],
  status: "active",
  currentPrice: "7000.00",
  startingPrice: "4200.00",
  minBidIncrement: "250.00",
  auctionType: "english",
  startTime: new Date("2026-10-30T18:00:00Z"),
  endTime: new Date("2026-11-03T21:06:00Z"),
  extendedUntil: new Date("2026-11-03T21:08:00Z"),
  winnerId: "bidder-9",
  hasWinner: true,
  resultPending: true,
  hasReserve: true,
  reserveMet: true,
  marketingDetails: { estimate: { low: "6000", high: "9000", currency: "GBP" } },
} as unknown as PublicLotView;

const LIVE_VALUES = ["7000.00", "bidder-9", "2026-11-03T21:06:00.000Z", "2026-11-03T21:08:00.000Z"];

function leaks(value: unknown): string[] {
  const text = JSON.stringify(value);
  return LIVE_VALUES.filter((v) => text.includes(v));
}

describe("withoutLiveBidState", () => {
  it("keeps the catalogue and drops every bid field", () => {
    const lot = withoutLiveBidState(LIVE);
    expect(leaks(lot)).toEqual([]);
    expect(lot.status).toBe("scheduled");
    expect(lot.currentPrice).toBe("4200.00");
    expect("hasWinner" in lot).toBe(false);
    expect("resultPending" in lot).toBe(false);
    expect(lot.reserveMet).toBeNull();
    expect(lot.title).toBe("A painting");
    expect(lot.hasReserve).toBe(true);
  });
});

describe("toLotTemplateData", () => {
  it("hands the template no price, status, close, winner, result or reserve met", () => {
    const data = toLotTemplateData({
      auction: LIVE,
      lotPath: "/lot/a-painting/lot-1",
      shareUrl: "https://example.test/lot/a-painting/lot-1",
      saleLifecycle: null,
      parentSale: null,
      signedIn: false,
      watching: false,
      artist: null,
      documents: [],
      buyersPremium: null,
      viewer: null,
    });
    expect(leaks(data.source)).toEqual([]);
    expect(Object.keys(data.source.lot).sort()).toEqual(
      [
        "auctionType",
        "hasReserve",
        "id",
        "marketingDetails",
        "minBidIncrement",
        "startTime",
        "startingPrice",
      ].sort(),
    );
  });
});

describe("lotProductJsonLd on the public page", () => {
  it("quotes the opening price and says nothing of availability or the close", () => {
    const ld = lotProductJsonLd(LIVE, { catalogueOnly: true });
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.price).toBe("4200.00");
    expect(offers.availability).toBeUndefined();
    expect(offers.priceValidUntil).toBeUndefined();
    expect(leaks(ld)).toEqual([]);
  });

  it("is unchanged elsewhere", () => {
    const offers = lotProductJsonLd(LIVE).offers as Record<string, unknown>;
    expect(offers.price).toBe("7000.00");
    expect(offers.availability).toBe("https://schema.org/InStock");
  });
});
