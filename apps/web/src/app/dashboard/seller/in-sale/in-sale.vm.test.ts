import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  filterInSaleRows,
  inSaleFilterHref,
  parseSellerLotStatusFilter,
  sortInSaleRows,
  toInSaleDisplayRows,
} from "./in-sale.vm";

function lot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 12,
    sellerId: "seller-1",
    title: "Untitled, oil on canvas",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: "500.00",
    buyNowPrice: null,
    currentPrice: "350.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "25.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-04-01T10:00:00.000Z"),
    endTime: new Date("2026-04-10T18:00:00.000Z"),
    status: "active",
    winnerId: null,
    createdAt: new Date("2026-03-01T10:00:00.000Z"),
    updatedAt: new Date("2026-03-15T10:00:00.000Z"),
    marketingDetails: {},
    ...overrides,
  };
}

const saleMap = new Map([["sale-1", { id: "sale-1", title: "Spring Modern Sale" }]]);

describe("toInSaleDisplayRows", () => {
  it("derives reserveMet=false when current price is below reserve", () => {
    const [out] = toInSaleDisplayRows(
      [lot({ currentPrice: "350.00", reservePrice: "500.00" })],
      saleMap,
    );
    expect(out?.reserveMet).toBe(false);
    expect(out?.reserveLabel).toBe("Below reserve");
  });

  it("derives reserveMet=true when current price meets reserve", () => {
    const [out] = toInSaleDisplayRows(
      [lot({ currentPrice: "500.00", reservePrice: "500.00" })],
      saleMap,
    );
    expect(out?.reserveMet).toBe(true);
    expect(out?.reserveLabel).toBe("Met");
  });

  it("treats missing reserve as met with 'No reserve' label", () => {
    const [out] = toInSaleDisplayRows([lot({ reservePrice: null })], saleMap);
    expect(out?.reserveMet).toBe(true);
    expect(out?.reserveLabel).toBe("No reserve");
  });

  it("emits a public lot href and sale href when sale is in the lookup", () => {
    const [out] = toInSaleDisplayRows([lot()], saleMap);
    expect(out?.lotHref).toMatch(/^\/lot\//);
    expect(out?.lotHref).toContain("lot-1");
    expect(out?.saleHref).toMatch(/^\/sales\//);
    expect(out?.saleTitle).toBe("Spring Modern Sale");
  });

  it("omits sale link when sale is missing from lookup", () => {
    const [out] = toInSaleDisplayRows([lot({ saleId: "missing" })], new Map());
    expect(out?.saleHref).toBeNull();
    expect(out?.saleTitle).toBeNull();
  });

  it("formats lot number with hash prefix or em dash when null", () => {
    const [a] = toInSaleDisplayRows([lot({ lotNumber: 7 })], saleMap);
    const [b] = toInSaleDisplayRows([lot({ lotNumber: null })], saleMap);
    expect(a?.lotNumberLabel).toBe("#7");
    expect(b?.lotNumberLabel).toBe("—");
  });

  it("labels ended no-sale below reserve", () => {
    const [out] = toInSaleDisplayRows(
      [
        lot({
          status: "ended",
          currentPrice: "350.00",
          reservePrice: "500.00",
          winnerId: null,
        }),
      ],
      saleMap,
    );
    expect(out?.saleOutcome).toBe("passed");
    expect(out?.reserveLabel).toBe("No sale · below reserve");
  });

  it("labels ended sold with reserve met", () => {
    const [out] = toInSaleDisplayRows(
      [
        lot({
          status: "ended",
          currentPrice: "500.00",
          reservePrice: "500.00",
          winnerId: "buyer-1",
        }),
      ],
      saleMap,
    );
    expect(out?.saleOutcome).toBe("sold");
    expect(out?.reserveLabel).toBe("Sold · reserve met");
  });

  it("maps lot statuses to expected tones", () => {
    const out = toInSaleDisplayRows(
      [
        lot({ id: "1", status: "active" }),
        lot({ id: "2", status: "scheduled" }),
        lot({ id: "3", status: "ended" }),
        lot({ id: "4", status: "cancelled" }),
        lot({ id: "5", status: "voided" }),
        lot({ id: "6", status: "draft" }),
      ],
      saleMap,
    );
    expect(out.map((r) => r.statusDotTone)).toEqual([
      "live",
      "info",
      "neutral",
      "critical",
      "critical",
      "info",
    ]);
  });
});

describe("filterInSaleRows", () => {
  const rows = toInSaleDisplayRows(
    [
      lot({ id: "active", status: "active" }),
      lot({ id: "scheduled", status: "scheduled" }),
      lot({ id: "ended", status: "ended" }),
      lot({ id: "cancelled", status: "cancelled" }),
      lot({ id: "draft", status: "draft" }),
    ],
    saleMap,
  );

  it("'live' filter includes active and scheduled", () => {
    expect(filterInSaleRows(rows, "live").map((r) => r.id)).toEqual(["active", "scheduled"]);
  });

  it("'scheduled' filter includes only scheduled", () => {
    expect(filterInSaleRows(rows, "scheduled").map((r) => r.id)).toEqual(["scheduled"]);
  });

  it("'ended' filter includes ended/cancelled/voided", () => {
    expect(filterInSaleRows(rows, "ended").map((r) => r.id)).toEqual(["ended", "cancelled"]);
  });

  it("'all' filter returns all rows", () => {
    expect(filterInSaleRows(rows, "all").length).toBe(rows.length);
  });
});

describe("sortInSaleRows", () => {
  it("sorts active first, then scheduled, then ended, with ascending end times for upcoming and descending for past", () => {
    const rows = toInSaleDisplayRows(
      [
        lot({ id: "ended-old", status: "ended", endTime: new Date("2026-01-01T00:00:00Z") }),
        lot({ id: "ended-new", status: "ended", endTime: new Date("2026-03-01T00:00:00Z") }),
        lot({ id: "active-late", status: "active", endTime: new Date("2026-05-01T00:00:00Z") }),
        lot({ id: "active-soon", status: "active", endTime: new Date("2026-04-01T00:00:00Z") }),
        lot({ id: "scheduled", status: "scheduled", endTime: new Date("2026-06-01T00:00:00Z") }),
      ],
      saleMap,
    );
    const sorted = sortInSaleRows(rows);
    expect(sorted.map((r) => r.id)).toEqual([
      "active-soon",
      "active-late",
      "scheduled",
      "ended-new",
      "ended-old",
    ]);
  });
});

describe("parseSellerLotStatusFilter", () => {
  it("defaults to 'live'", () => {
    expect(parseSellerLotStatusFilter(undefined)).toBe("live");
    expect(parseSellerLotStatusFilter(null)).toBe("live");
    expect(parseSellerLotStatusFilter("nonsense")).toBe("live");
  });
  it("recognises known values", () => {
    expect(parseSellerLotStatusFilter("scheduled")).toBe("scheduled");
    expect(parseSellerLotStatusFilter("ended")).toBe("ended");
    expect(parseSellerLotStatusFilter("all")).toBe("all");
  });
});

describe("inSaleFilterHref", () => {
  it("omits status param for default 'live' filter", () => {
    expect(inSaleFilterHref("/dashboard/seller/in-sale", "live")).toBe("/dashboard/seller/in-sale");
  });
  it("appends status param for non-default filters", () => {
    expect(inSaleFilterHref("/dashboard/seller/in-sale", "ended")).toBe(
      "/dashboard/seller/in-sale?status=ended",
    );
  });
});
