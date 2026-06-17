import { formatOnsitePreviewHoursLabel } from "@/lib/onsite/preview-hours-label";
import type { Sale } from "@auction/types";
import { describe, expect, it } from "vitest";

const now = Date.parse("2026-06-01T12:00:00.000Z");

function makeSale(overrides: Partial<Sale> = {}): Sale {
  const created = new Date(now);
  return {
    id: "sale-1",
    title: "Evening Sale",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "onsite",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    locationName: "London Gallery",
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: "1 Test Street",
    locationAddressLine2: null,
    locationCity: "London",
    locationCounty: null,
    locationPostcode: "W1 1AA",
    locationCountry: "United Kingdom",
    status: "scheduled",
    startTime: new Date(now + 86_400_000),
    endTime: new Date(now + 172_800_000),
    previewStartTime: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: created,
    updatedAt: created,
    ...overrides,
  };
}

describe("formatOnsitePreviewHoursLabel", () => {
  it("uses sale preview window when previewStartTime is available", () => {
    const sale = makeSale({
      previewStartTime: new Date(now + 43_200_000),
      startTime: new Date(now + 86_400_000),
    });
    const label = formatOnsitePreviewHoursLabel(sale);
    expect(label).toMatch(/^Preview from /);
    expect(label).toMatch(/until session opens /);
  });

  it("falls back to site business hours when preview is absent", () => {
    const label = formatOnsitePreviewHoursLabel(makeSale());
    expect(label).toMatch(/Weekdays|Mon|Tue|09:00/i);
  });
});
