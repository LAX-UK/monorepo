import type { Lot, Sale } from "@auction/types";

/** A lot with a photograph and a readable size; override what a test cares about. */
export function hangLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    title: "Harbour at First Light",
    description: null,
    medium: null,
    dimensions: "80 x 60 cm",
    images: ["/img/lot-1.jpg"],
    imageAssets: [{ src: "/img/lot-1.jpg", width: 1200, height: 1600 }],
    categoryId: "c",
    auctionType: "english",
    startingPrice: "1000.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "1000.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "100.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-11-03T10:00:00.000Z"),
    endTime: new Date("2026-11-03T21:00:00.000Z"),
    status: "active",
    winnerId: null,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-01T10:00:00.000Z"),
    marketingDetails: {},
    ...overrides,
  };
}

export function hangSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "sale-1",
    title: "Modern & Contemporary: Online",
    description: null,
    coverImages: [],
    categoryId: null,
    categoryIds: [],
    deliveryMode: "online",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    heroPresentation: "cover",
    heroVideoUrl: null,
    locationName: null,
    locationAddress: null,
    status: "active",
    startTime: new Date("2026-11-01T10:00:00.000Z"),
    endTime: new Date("2026-11-03T21:00:00.000Z"),
    previewStartTime: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdBy: "u1",
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    updatedAt: new Date("2026-10-01T10:00:00.000Z"),
    ...overrides,
  } as Sale;
}
