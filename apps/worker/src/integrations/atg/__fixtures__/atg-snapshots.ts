import type { AtgLotSnapshot, AtgSaleSnapshot, AtgSyncConfig } from "../atg-types.js";

export const testAtgConfig: AtgSyncConfig = {
  platformCode: "LAX",
  clientId: "client-1",
  incrementSetId: "inc-1",
  defaultCategory: "Fine Art",
  artistPlacement: "description",
  currency: "GBP",
  countryCode: "UK",
  timezone: "Europe/London",
  mediaBaseUrl: "https://media.example/",
  maxImagesPerLot: 3,
};

export function testLot(overrides: Partial<AtgLotSnapshot> = {}): AtgLotSnapshot {
  return {
    id: "lot-1",
    lotNumber: 1,
    title: "Untitled (Blue)",
    description: "Signed lower right.",
    medium: "Oil on canvas",
    dimensions: "60 x 50 cm",
    artistName: "Jane Painter",
    images: ["lots/lot-1/a.jpg"],
    startingPrice: "500.00",
    reservePrice: "800.00",
    buyNowPrice: null,
    buyerPremiumRate: "0.2500",
    endTime: new Date("2026-11-01T18:00:00Z"),
    marketingDetails: { estimate: { low: "800", high: "1200", currency: "GBP" } },
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}

export function testSale(overrides: Partial<AtgSaleSnapshot> = {}): AtgSaleSnapshot {
  return {
    id: "sale-1",
    title: "Autumn Contemporary",
    description: "Viewing by appointment.",
    terms: "Standard terms apply.",
    startTime: new Date("2026-10-20T10:00:00Z"),
    endTime: new Date("2026-11-01T18:00:00Z"),
    saleStatus: "draft",
    buyerPremiumRate: "0.2500",
    buyerPremiumTiers: null,
    locationAddressLine1: "1 Gallery Road",
    locationAddressLine2: null,
    locationCity: "London",
    locationPostcode: "W1 1AA",
    locationCountry: "United Kingdom",
    cancelled: false,
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    atgSettings: { auctionType: "Timed", distribution: "private_test" },
    lots: [testLot()],
    ...overrides,
  };
}
