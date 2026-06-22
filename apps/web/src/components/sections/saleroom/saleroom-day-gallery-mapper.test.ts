import { mapSaleToDayGalleryVM } from "@/components/sections/saleroom/mappers";
import type { Sale } from "@auction/types";
import { describe, expect, it } from "vitest";

function baseSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "s1",
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
    ...overrides,
  };
}

describe("mapSaleToDayGalleryVM", () => {
  it("returns null when sale is not ended", () => {
    const sale = baseSale({ status: "active" });
    expect(mapSaleToDayGalleryVM(sale)).toBeNull();
  });

  it("returns null for online delivery mode", () => {
    const sale = baseSale({ deliveryMode: "online" });
    expect(mapSaleToDayGalleryVM(sale)).toBeNull();
  });

  it("returns null when no dayImageAssets", () => {
    const sale = baseSale();
    expect(mapSaleToDayGalleryVM(sale)).toBeNull();
  });

  it("returns null when dayImageAssets is empty", () => {
    const sale = baseSale({ dayImageAssets: [] });
    expect(mapSaleToDayGalleryVM(sale)).toBeNull();
  });

  it("returns a DayGalleryVM for ended onsite sale with photos", () => {
    const sale = baseSale({
      dayImageAssets: [
        { mediaType: "image", src: "https://cdn.example/day-1.jpg", caption: "On the block" },
      ],
    });
    const vm = mapSaleToDayGalleryVM(sale);
    expect(vm).not.toBeNull();
    expect(vm?.items).toHaveLength(1);
    expect(vm?.items[0]?.caption).toBe("On the block");
  });

  it("applies alt-text fallback when alt is missing", () => {
    const sale = baseSale({
      dayImageAssets: [
        { mediaType: "image", src: "https://cdn.example/d1.jpg" },
        { mediaType: "image", src: "https://cdn.example/d2.jpg" },
      ],
    });
    const vm = mapSaleToDayGalleryVM(sale);
    const item0 = vm?.items[0];
    const item1 = vm?.items[1];
    expect(item0?.mediaType === "image" && item0.alt).toBe("Evening Sale — auction day photo 1");
    expect(item1?.mediaType === "image" && item1.alt).toBe("Evening Sale — auction day photo 2");
  });

  it("preserves existing alt text when provided", () => {
    const sale = baseSale({
      dayImageAssets: [
        { mediaType: "image", src: "https://cdn.example/d1.jpg", alt: "Bidder raising paddle" },
      ],
    });
    const vm = mapSaleToDayGalleryVM(sale);
    const item = vm?.items[0];
    expect(item?.mediaType === "image" && item.alt).toBe("Bidder raising paddle");
  });

  it("passes through video items unchanged", () => {
    const sale = baseSale({
      dayImageAssets: [
        { mediaType: "image", src: "https://cdn.example/photo.jpg" },
        { mediaType: "video", src: "https://cdn.example/clip.mp4", caption: "Lot 10 selling" },
      ],
    });
    const vm = mapSaleToDayGalleryVM(sale);
    expect(vm?.items).toHaveLength(2);
    expect(vm?.items[1]?.mediaType).toBe("video");
    expect(vm?.items[1]?.caption).toBe("Lot 10 selling");
  });

  it("works for ended hybrid sale", () => {
    const sale = baseSale({
      deliveryMode: "hybrid",
      dayImageAssets: [{ mediaType: "image", src: "https://cdn.example/d1.jpg" }],
    });
    expect(mapSaleToDayGalleryVM(sale)).not.toBeNull();
  });

  it("resolves storage keys to CDN URLs when media base is configured", () => {
    const prev = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "https://cdn.example";
    try {
      const sale = baseSale({
        dayImageAssets: [{ mediaType: "image", src: "uploads/pending/sale-day/user/photo.jpg" }],
      });
      const vm = mapSaleToDayGalleryVM(sale);
      expect(vm?.items[0]?.mediaType === "image" && vm.items[0].src).toBe(
        "https://cdn.example/uploads/pending/sale-day/user/photo.jpg",
      );
    } finally {
      if (prev === undefined) process.env.NEXT_PUBLIC_MEDIA_BASE_URL = undefined;
      else process.env.NEXT_PUBLIC_MEDIA_BASE_URL = prev;
    }
  });

  it("falls back to dayImages refs when dayImageAssets is absent", () => {
    const prev = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "https://cdn.example";
    try {
      const sale = baseSale({
        dayImages: [{ key: "uploads/pending/sale-day/user/photo.jpg", caption: "Floor" }],
      });
      const vm = mapSaleToDayGalleryVM(sale);
      expect(vm?.items).toHaveLength(1);
      expect(vm?.items[0]).toMatchObject({
        mediaType: "image",
        src: "https://cdn.example/uploads/pending/sale-day/user/photo.jpg",
        caption: "Floor",
      });
    } finally {
      if (prev === undefined) process.env.NEXT_PUBLIC_MEDIA_BASE_URL = undefined;
      else process.env.NEXT_PUBLIC_MEDIA_BASE_URL = prev;
    }
  });
});
