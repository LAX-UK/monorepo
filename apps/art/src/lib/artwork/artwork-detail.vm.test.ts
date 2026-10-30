import { artworkDetail } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  ARTWORK_FAQS,
  artworkCategoryHref,
  artworkCertificateLine,
  artworkPriceNote,
  artworkPromise,
  artworkStageRatio,
  buildArtworkBreadcrumb,
  buildArtworkKeySpecs,
  clampArtworkStageRatio,
  formatArtworkDimensions,
} from "./artwork-detail.vm.js";

describe("formatArtworkDimensions", () => {
  it("derives centimetres and inches rounded to one decimal", () => {
    expect(formatArtworkDimensions({ heightCm: 120, widthCm: 90, depthCm: null })).toEqual({
      cm: "120 × 90 cm",
      inches: "47.2 × 35.4 in",
    });
  });

  it("includes a positive depth and rounds fractional centimetres", () => {
    expect(formatArtworkDimensions({ heightCm: 40.25, widthCm: 50, depthCm: 3 })).toEqual({
      cm: "40.3 × 50 × 3 cm",
      inches: "15.8 × 19.7 × 1.2 in",
    });
    expect(formatArtworkDimensions({ heightCm: 40, widthCm: 50, depthCm: 0 })?.cm).toBe(
      "40 × 50 cm",
    );
  });

  it("returns null without both height and width", () => {
    expect(formatArtworkDimensions({ heightCm: 40, widthCm: null, depthCm: null })).toBeNull();
    expect(formatArtworkDimensions({})).toBeNull();
  });
});

describe("buildArtworkKeySpecs", () => {
  it("lists year, medium and dimensions with cm and inches on separate lines", () => {
    expect(
      buildArtworkKeySpecs(
        artworkDetail({
          yearCreated: 2026,
          objectType: null,
          medium: "Oil on canvas",
          heightCm: 120,
          widthCm: 90,
        }),
      ),
    ).toEqual([
      { label: "Year", lines: ["2026"] },
      { label: "Medium", lines: ["Oil on canvas"] },
      { label: "Dimensions", lines: ["120 × 90 cm", "47.2 × 35.4 in"] },
    ]);
  });

  it("falls back to the free-text dimensions and omits unknown facts", () => {
    expect(
      buildArtworkKeySpecs(
        artworkDetail({
          yearCreated: null,
          objectType: null,
          medium: null,
          dimensions: "16 × 20 in",
        }),
      ),
    ).toEqual([{ label: "Dimensions", lines: ["16 × 20 in"] }]);
    expect(
      buildArtworkKeySpecs(
        artworkDetail({ yearCreated: null, objectType: null, medium: null, dimensions: null }),
      ),
    ).toEqual([]);
  });
});

describe("artworkStageRatio", () => {
  it("shapes the stage like the work, between 3:4 and 16:10", () => {
    expect(artworkStageRatio({ heightCm: 60, widthCm: 60 })).toBe(1);
    expect(artworkStageRatio({ heightCm: 50, widthCm: 70 })).toBeCloseTo(1.4);
    expect(artworkStageRatio({ heightCm: 200, widthCm: 50 })).toBe(0.75);
    expect(artworkStageRatio({ heightCm: 20, widthCm: 100 })).toBe(1.6);
    expect(artworkStageRatio({ heightCm: null, widthCm: 40 })).toBeNull();
    expect(clampArtworkStageRatio(Number.NaN)).toBe(0.75);
  });
});

describe("the type fact", () => {
  it("names one work in the singular", () => {
    expect(buildArtworkKeySpecs(artworkDetail({ objectType: "painting" }))).toContainEqual({
      label: "Type",
      lines: ["Painting"],
    });
  });
});

describe("buildArtworkKeySpecs with a type", () => {
  it("lists the type once with the other facts, and never rarity", () => {
    expect(
      buildArtworkKeySpecs(
        artworkDetail({
          objectType: "work_on_paper",
          rarity: "limited_edition",
          yearCreated: null,
        }),
      ).map((row) => row.label),
    ).toEqual(["Type", "Medium", "Dimensions"]);
  });
});

describe("artworkPromise", () => {
  const gallery = { name: "LAX Marylebone", address: "156 New Cavendish Street, London" };

  it("says who replies and where to see the work while it is available", () => {
    expect(artworkPromise(artworkDetail({ saleState: "price_on_application" }), gallery)).toEqual({
      reply: "The gallery team replies within one working day.",
      viewing: "Viewing by appointment at LAX Marylebone, 156 New Cavendish Street, London.",
    });
  });

  it("makes no promise once the work is sold", () => {
    expect(artworkPromise(artworkDetail({ saleState: "sold" }), gallery)).toBeNull();
  });
});

describe("ARTWORK_FAQS", () => {
  it("sends selling to LAX Bid, never a consignment", () => {
    const selling = ARTWORK_FAQS.find((faq) => faq.id === "selling");
    expect(selling?.answer).toMatch(/does not take works on consignment/);
    expect(selling?.link?.href).toBe("/how-to-sell");
  });
});

describe("buildArtworkBreadcrumb", () => {
  it("links Artworks and the object type's catalogue, ending on the title", () => {
    expect(buildArtworkBreadcrumb(artworkDetail({ objectType: "painting" }))).toEqual([
      { label: "Artworks", href: "/artworks" },
      { label: "Paintings", href: "/paintings" },
      { label: "Warm Basket" },
    ]);
    expect(buildArtworkBreadcrumb(artworkDetail({ objectType: "photography" }))[1]).toEqual({
      label: "Photography",
      href: "/artworks?objectType=photography",
    });
  });

  it("skips the category level when the object type is unknown", () => {
    expect(buildArtworkBreadcrumb(artworkDetail({ objectType: null }))).toEqual([
      { label: "Artworks", href: "/artworks" },
      { label: "Warm Basket" },
    ]);
    expect(artworkCategoryHref({ objectType: null })).toBeNull();
  });
});

describe("price and certificate lines", () => {
  it("offers discretion while the work is available and nothing once sold", () => {
    expect(artworkPriceNote(artworkDetail())).toMatch(/complete discretion/);
    expect(artworkPriceNote(artworkDetail({ saleState: "sold" }))).toBeNull();
  });

  it("mentions the certificate only when one ships", () => {
    expect(artworkCertificateLine({ hasCertificate: true })).toBe(
      "Includes a certificate of authenticity",
    );
    expect(artworkCertificateLine({ hasCertificate: false })).toBeNull();
  });
});
