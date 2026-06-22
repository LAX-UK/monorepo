import type { Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { saleRecordingVideoJsonLd } from "./structured-data";

const now = new Date("2026-06-01T12:00:00.000Z");

const baseSale: Sale = {
  id: "sale-1",
  title: "Evening Sale",
  description: "A curated sale of modern works.",
  coverImages: [],
  categoryId: null,
  deliveryMode: "onsite",
  allowOnlineBidsBeforeGoLive: false,
  streamUrl: "https://www.youtube.com/watch?v=abc",
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
  startTime: new Date("2026-06-14T18:00:00.000Z"),
  endTime: new Date("2026-06-14T21:00:00.000Z"),
  previewStartTime: null,
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: null,
  terms: null,
  createdAt: now,
  updatedAt: now,
};

describe("saleRecordingVideoJsonLd", () => {
  it("emits VideoObject with name, uploadDate, embedUrl, and url", () => {
    const ld = saleRecordingVideoJsonLd(
      baseSale,
      "https://www.youtube.com/embed/abc",
      "/poster.jpg",
    );

    expect(ld["@type"]).toBe("VideoObject");
    expect(ld.name).toBe("Evening Sale — saleroom recording");
    expect(ld.embedUrl).toBe("https://www.youtube.com/embed/abc");
    expect(ld.thumbnailUrl).toBe("/poster.jpg");
    expect(typeof ld.uploadDate).toBe("string");
    expect(String(ld.uploadDate)).toContain("2026-06-14");
    expect(ld["@context"]).toBe("https://schema.org");
  });

  it("uses sale description when present", () => {
    const ld = saleRecordingVideoJsonLd(baseSale, "https://www.youtube.com/embed/abc", null);
    expect(ld.description).toBe("A curated sale of modern works.");
  });

  it("falls back to generic description when sale.description is null", () => {
    const sale = { ...baseSale, description: null };
    const ld = saleRecordingVideoJsonLd(sale, "https://www.youtube.com/embed/abc", null);
    expect(String(ld.description)).toContain("Evening Sale");
  });

  it("omits thumbnailUrl when posterUrl is null", () => {
    const ld = saleRecordingVideoJsonLd(baseSale, "https://www.youtube.com/embed/abc", null);
    expect(ld.thumbnailUrl).toBeUndefined();
  });
});
