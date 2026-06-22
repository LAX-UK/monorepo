import { saleDayGalleryJsonLd } from "@/lib/seo/structured-data";
import type { Sale, SaleDayMedia } from "@auction/types";
import { describe, expect, it } from "vitest";

const baseSale = {
  id: "sale-1",
  title: "Evening Sale",
  description: null,
  coverImages: [],
  categoryId: null,
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
  startTime: new Date("2026-06-01T10:00:00.000Z"),
  endTime: new Date("2026-06-01T18:00:00.000Z"),
  previewStartTime: null,
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: null,
  terms: null,
  createdByLegalEntityId: "le-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-06-01"),
} satisfies Sale;

const photos: SaleDayMedia[] = [
  {
    mediaType: "image",
    src: "https://cdn.example/day-1.jpg",
    caption: "Lot 1 on the block",
    width: 1200,
    height: 800,
  },
  { mediaType: "image", src: "https://cdn.example/day-2.jpg", alt: "Bidder raising paddle" },
];

describe("saleDayGalleryJsonLd", () => {
  it("returns null when no photos", () => {
    expect(saleDayGalleryJsonLd(baseSale, [])).toBeNull();
  });

  it("emits ImageGallery type", () => {
    const ld = saleDayGalleryJsonLd(baseSale, photos);
    expect(ld?.["@type"]).toBe("ImageGallery");
    expect(ld?.["@context"]).toBe("https://schema.org");
  });

  it("emits associatedMedia array with correct length", () => {
    const ld = saleDayGalleryJsonLd(baseSale, photos);
    const items = ld?.associatedMedia as unknown[];
    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(2);
  });

  it("first image has representativeOfPage: true", () => {
    const ld = saleDayGalleryJsonLd(baseSale, photos);
    const items = ld?.associatedMedia as Array<Record<string, unknown>>;
    expect(items[0]?.representativeOfPage).toBe(true);
    expect(items[1]?.representativeOfPage).toBeUndefined();
  });

  it("includes caption as name on first image", () => {
    const ld = saleDayGalleryJsonLd(baseSale, photos);
    const items = ld?.associatedMedia as Array<Record<string, unknown>>;
    expect(items[0]?.name).toBe("Lot 1 on the block");
  });

  it("includes width and height when present", () => {
    const ld = saleDayGalleryJsonLd(baseSale, photos);
    const items = ld?.associatedMedia as Array<Record<string, unknown>>;
    expect(items[0]?.width).toBe("1200");
    expect(items[0]?.height).toBe("800");
  });

  it("uses alt fallback for image name when no caption", () => {
    const ld = saleDayGalleryJsonLd(baseSale, photos);
    const items = ld?.associatedMedia as Array<Record<string, unknown>>;
    expect(items[1]?.name).toBe("Bidder raising paddle");
  });
});
