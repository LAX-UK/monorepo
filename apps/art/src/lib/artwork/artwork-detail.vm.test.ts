import { artworkDetail } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  artworkCategoryHref,
  artworkCertificateLine,
  artworkPriceNote,
  buildArtworkBreadcrumb,
  buildArtworkKeySpecs,
  buildArtworkMediumSpecs,
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
        artworkDetail({ yearCreated: 2026, medium: "Oil on canvas", heightCm: 120, widthCm: 90 }),
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
        artworkDetail({ yearCreated: null, medium: null, dimensions: "16 × 20 in" }),
      ),
    ).toEqual([{ label: "Dimensions", lines: ["16 × 20 in"] }]);
    expect(
      buildArtworkKeySpecs(artworkDetail({ yearCreated: null, medium: null, dimensions: null })),
    ).toEqual([]);
  });
});

describe("buildArtworkMediumSpecs", () => {
  it("adds object type and rarity to the physical facts", () => {
    expect(
      buildArtworkMediumSpecs(
        artworkDetail({ objectType: "work_on_paper", rarity: "limited_edition" }),
      ),
    ).toEqual([
      { label: "Object type", lines: ["Works on paper"] },
      { label: "Rarity", lines: ["Limited edition"] },
      { label: "Medium", lines: ["Oil on linen"] },
      { label: "Dimensions", lines: ["40 × 50 cm"] },
    ]);
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
