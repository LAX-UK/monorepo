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
  status: "active",
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

describe("parseSale — pressCoverage", () => {
  it("returns no pressCoverage when field is absent", () => {
    const sale = parseSale(baseSaleRaw);
    expect(sale.pressCoverage).toBeUndefined();
  });

  it("parses valid press refs", () => {
    const sale = parseSale({
      ...baseSaleRaw,
      pressCoverage: [
        {
          url: "https://dailymail.co.uk/article/123",
          headline: "Stunning result at LAX auction",
          outletName: "Daily Mail",
          publishedAt: "2026-06-02",
          excerpt: "A record-breaking evening.",
          mentionType: "feature",
        },
      ],
    });
    expect(sale.pressCoverage).toHaveLength(1);
    expect(sale.pressCoverage?.[0]).toMatchObject({
      url: "https://dailymail.co.uk/article/123",
      headline: "Stunning result at LAX auction",
      outletName: "Daily Mail",
      publishedAt: "2026-06-02",
      excerpt: "A record-breaking evening.",
      mentionType: "feature",
    });
  });

  it("silently skips entries missing url or headline", () => {
    const sale = parseSale({
      ...baseSaleRaw,
      pressCoverage: [
        { url: "", headline: "Missing URL", outletName: "Test" },
        { url: "https://example.com/article", headline: "", outletName: "Test" },
        { url: "https://example.com/ok", headline: "Valid", outletName: "Valid Outlet" },
      ],
    });
    expect(sale.pressCoverage).toHaveLength(1);
    expect(sale.pressCoverage?.[0]?.headline).toBe("Valid");
  });

  it("silently skips entries missing outletName", () => {
    const sale = parseSale({
      ...baseSaleRaw,
      pressCoverage: [{ url: "https://example.com", headline: "Test", outletName: "" }],
    });
    expect(sale.pressCoverage).toBeUndefined();
  });

  it("ignores unknown mentionType values", () => {
    const sale = parseSale({
      ...baseSaleRaw,
      pressCoverage: [
        {
          url: "https://example.com/article",
          headline: "Test",
          outletName: "Test Outlet",
          mentionType: "unknown_type",
        },
      ],
    });
    expect(sale.pressCoverage?.[0]?.mentionType).toBeUndefined();
  });
});
