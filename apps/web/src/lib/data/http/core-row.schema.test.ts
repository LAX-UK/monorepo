import { parseBidSchema } from "@/lib/data/http/bid.schema";
import { parseLotSchema, parsePublicLotViewSchema } from "@/lib/data/http/lot.schema";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { parseSaleSchema } from "@/lib/data/http/sale.schema";
import { describe, expect, it } from "vitest";

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date(Number.NaN);
}

function legacyParseBid(raw: unknown) {
  const o = isIndexableObject(raw) ? raw : {};
  const placedByUserId =
    o.placedByUserId == null || o.placedByUserId === "" ? undefined : String(o.placedByUserId);
  const bidderId = o.bidderId == null || o.bidderId === "" ? placedByUserId : String(o.bidderId);
  const placedVia = o.placedVia == null || o.placedVia === "" ? null : String(o.placedVia);
  const clerkUserId = o.clerkUserId == null || o.clerkUserId === "" ? null : String(o.clerkUserId);
  return {
    id: String(o.id),
    lotId: String(o.lotId ?? o.auctionId),
    ...(bidderId ? { bidderId } : {}),
    ...(placedByUserId ? { placedByUserId } : {}),
    amount: String(o.amount),
    isWinning: Boolean(o.isWinning),
    isAutoBid: Boolean(o.isAutoBid),
    maxAutoBidAmount: o.maxAutoBidAmount == null ? null : String(o.maxAutoBidAmount),
    autoBidStepAmount: o.autoBidStepAmount == null ? null : String(o.autoBidStepAmount),
    placedVia,
    clerkUserId,
    createdAt: toDate(o.createdAt),
  };
}

const baseSaleRaw = {
  id: "sale-1",
  title: "Evening Sale",
  description: null,
  coverImages: [],
  categoryId: null,
  categoryIds: [],
  deliveryMode: "onsite",
  allowOnlineBidsBeforeGoLive: false,
  streamUrl: null,
  locationName: null,
  locationAddress: null,
  locationMapUrl: null,
  locationAddressLine1: null,
  locationAddressLine2: null,
  locationCity: null,
  locationCounty: null,
  locationPostcode: null,
  locationCountry: null,
  status: "ended",
  startTime: "2026-06-01T10:00:00.000Z",
  endTime: "2026-06-01T18:00:00.000Z",
  previewStartTime: null,
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: null,
  terms: null,
  createdBy: "admin",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-06-01T18:00:00.000Z",
};

const baseLotRaw = {
  id: "lot-1",
  saleId: "sale-1",
  lotNumber: 12,
  title: "Vase",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId: "cat-1",
  categoryIds: [],
  auctionType: "english",
  startingPrice: "100.00",
  reservePrice: "500.00",
  buyNowPrice: null,
  currentPrice: "100.00",
  buyerPremiumRate: "0.25",
  minBidIncrement: "10.00",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 60_000,
  dutchLastDecrementAt: null,
  startTime: "2026-06-01T10:00:00.000Z",
  endTime: "2026-06-01T18:00:00.000Z",
  status: "active",
  winnerId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  marketingDetails: {},
};

describe("core row schema parity", () => {
  it("bid schema matches legacy parser", () => {
    const fixture = {
      id: "bid-1",
      lotId: "lot-1",
      placedByUserId: "user-1",
      amount: "110.00",
      isWinning: true,
      isAutoBid: true,
      maxAutoBidAmount: "500.00",
      autoBidStepAmount: "10.00",
      placedVia: "saleroom",
      clerkUserId: "clerk-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    expect(parseBidSchema(fixture)).toEqual(legacyParseBid(fixture));
  });

  it("sale schema matches legacy defaults for missing deliveryMode", () => {
    const fixture = { ...baseSaleRaw, deliveryMode: "bogus" };
    const legacy = {
      ...baseSaleRaw,
      deliveryMode: "onsite",
      coverImages: [],
      categoryIds: [],
      description: null,
      categoryId: null,
      allowOnlineBidsBeforeGoLive: false,
      streamUrl: null,
      locationName: null,
      locationAddress: null,
      locationMapUrl: null,
      locationAddressLine1: null,
      locationAddressLine2: null,
      locationCity: null,
      locationCounty: null,
      locationPostcode: null,
      locationCountry: null,
      status: "ended",
      previewStartTime: null,
      buyerPremiumRate: "0.25",
      buyerPremiumTiers: null,
      terms: null,
      createdBy: "admin",
      startTime: new Date("2026-06-01T10:00:00.000Z"),
      endTime: new Date("2026-06-01T18:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T18:00:00.000Z"),
    };
    expect(parseSaleSchema(fixture)).toEqual(legacy);
  });

  it("lot schema matches legacy lotNumber coercion", () => {
    const fixture = { ...baseLotRaw, lotNumber: "7" };
    const parsed = parseLotSchema(fixture);
    expect(parsed.lotNumber).toBe(7);
    expect(parsed.startingPrice).toBe("100.00");
    expect(parsed.minBidIncrement).toBe("10.00");
  });

  it("public lot view schema withholds reserve when hasReserve is set", () => {
    const fixture = {
      ...baseLotRaw,
      hasReserve: true,
      reservePrice: undefined,
    };
    const parsed = parsePublicLotViewSchema(fixture);
    expect("hasReserve" in parsed && parsed.hasReserve).toBe(true);
    expect("reservePrice" in parsed).toBe(false);
  });
});
