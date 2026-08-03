import { mapSaleToPressCoverageVM } from "@/components/sections/saleroom/mappers";
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
    heroPresentation: "cover",
    heroVideoUrl: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    status: "active",
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

describe("mapSaleToPressCoverageVM", () => {
  it("returns null when pressCoverage is absent", () => {
    expect(mapSaleToPressCoverageVM(baseSale())).toBeNull();
  });

  it("returns null when pressCoverage is empty", () => {
    expect(mapSaleToPressCoverageVM(baseSale({ pressCoverage: [] }))).toBeNull();
  });

  it("maps a full press ref including domain extraction", () => {
    const sale = baseSale({
      pressCoverage: [
        {
          url: "https://www.dailymail.co.uk/article/123",
          headline: "Stunning results",
          outletName: "Daily Mail",
          publishedAt: "2026-06-02",
          excerpt: "A record evening.",
          mentionType: "feature",
        },
      ],
    });
    const vms = mapSaleToPressCoverageVM(sale);
    expect(vms).not.toBeNull();
    expect(vms).toHaveLength(1);
    expect(vms?.[0]?.domain).toBe("dailymail.co.uk");
    expect(vms?.[0]?.headline).toBe("Stunning results");
    expect(vms?.[0]?.excerpt).toBe("A record evening.");
    expect(vms?.[0]?.mentionType).toBe("feature");
  });

  it("formats dateLabel from publishedAt", () => {
    const sale = baseSale({
      pressCoverage: [
        {
          url: "https://example.com/article",
          headline: "Test",
          outletName: "Test Outlet",
          publishedAt: "2026-06-02",
        },
      ],
    });
    const vms = mapSaleToPressCoverageVM(sale);
    expect(vms?.[0]?.dateLabel).toContain("2026");
    expect(vms?.[0]?.dateLabel).toContain("Jun");
  });

  it("sets dateLabel to null when publishedAt is absent", () => {
    const sale = baseSale({
      pressCoverage: [{ url: "https://example.com/a", headline: "Test", outletName: "Outlet" }],
    });
    const vms = mapSaleToPressCoverageVM(sale);
    expect(vms?.[0]?.dateLabel).toBeNull();
  });

  it("strips www. from domain", () => {
    const sale = baseSale({
      pressCoverage: [
        { url: "https://www.hellomag.com/article", headline: "Test", outletName: "Hello" },
      ],
    });
    const vms = mapSaleToPressCoverageVM(sale);
    expect(vms?.[0]?.domain).toBe("hellomag.com");
  });

  it("works for any sale status — online, scheduled, active, ended", () => {
    for (const status of ["online", "scheduled", "active", "ended"] as const) {
      const sale = baseSale({
        deliveryMode: status === "online" ? "online" : "onsite",
        status: status === "online" ? "active" : status,
        pressCoverage: [{ url: "https://example.com", headline: "T", outletName: "O" }],
      });
      expect(mapSaleToPressCoverageVM(sale)).not.toBeNull();
    }
  });
});
