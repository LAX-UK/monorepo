import { parseSale } from "@/lib/data/http/parse";
import { describe, expect, it } from "vitest";

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

describe("parseSale — dayImages / dayImageAssets", () => {
  it("returns no dayImages when field is absent", () => {
    const sale = parseSale(baseSaleRaw);
    expect(sale.dayImages).toBeUndefined();
    expect(sale.dayImageAssets).toBeUndefined();
  });

  it("parses dayImages refs with caption and alt", () => {
    const sale = parseSale({
      ...baseSaleRaw,
      dayImages: [
        {
          key: "sale-day/photo-1.jpg",
          caption: "Lot 1 on the block",
          alt: "Bidders raising paddles",
        },
        { key: "sale-day/photo-2.jpg" },
      ],
    });
    expect(sale.dayImages).toHaveLength(2);
    expect(sale.dayImages?.[0]).toEqual({
      key: "sale-day/photo-1.jpg",
      caption: "Lot 1 on the block",
      alt: "Bidders raising paddles",
    });
    expect(sale.dayImages?.[1]).toEqual({ key: "sale-day/photo-2.jpg" });
  });

  it("parses dayImageAssets with caption", () => {
    const sale = parseSale({
      ...baseSaleRaw,
      dayImageAssets: [
        {
          src: "https://cdn.example/photo-1.jpg",
          width: 1200,
          height: 800,
          caption: "After the gavel",
        },
      ],
    });
    expect(sale.dayImageAssets).toHaveLength(1);
    expect(sale.dayImageAssets?.[0]).toMatchObject({
      src: "https://cdn.example/photo-1.jpg",
      width: 1200,
      height: 800,
      caption: "After the gavel",
    });
  });

  it("silently skips invalid dayImages entries (missing key)", () => {
    const sale = parseSale({
      ...baseSaleRaw,
      dayImages: [{ caption: "no key" }, { key: "valid.jpg" }],
    });
    expect(sale.dayImages).toHaveLength(1);
    expect(sale.dayImages?.[0]).toEqual({ key: "valid.jpg" });
  });
});
