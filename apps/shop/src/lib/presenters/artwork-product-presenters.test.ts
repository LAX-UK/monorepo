import { artworkProductJsonLd } from "@/lib/seo/artwork-structured-data";
import type { PublicArtworkDetail } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { presentArtworkPurchase } from "./artwork-purchase.presenter";
import { SCALE_FIGURE, presentArtworkScale } from "./artwork-scale.presenter";
import { artworkSizeText } from "./artwork-size.presenter";

function detail(overrides: Partial<PublicArtworkDetail> = {}): PublicArtworkDetail {
  return {
    slug: "warm-basket",
    title: "Warm Basket",
    artistName: "Emmett King",
    artistSlug: "emmett-king",
    imageUrl: "/warm-basket.webp",
    saleState: "for_sale",
    dimensions: null,
    medium: null,
    yearCreated: null,
    salesChannel: "shop",
    eligibleForEditionAllocation: true,
    printPricePence: 12_000,
    availability: { totalEditions: 24, state: "available" },
    description: null,
    images: [],
    heightCm: null,
    widthCm: null,
    depthCm: null,
    hasCertificate: false,
    ...overrides,
  };
}

describe("size text", () => {
  it("shows centimetres, then inches, from the structured size", () => {
    expect(artworkSizeText(detail({ heightCm: 60, widthCm: 45 }))).toBe(
      "60 × 45 cm (23.6 × 17.7 in)",
    );
  });

  it("falls back to the catalogued text on older records, and to nothing", () => {
    expect(artworkSizeText(detail({ dimensions: "40 × 50 cm" }))).toBe("40 × 50 cm");
    expect(artworkSizeText(detail())).toBeNull();
  });
});

describe("buy block", () => {
  it("shows the price with VAT included and whether it can be bought, never a count", () => {
    expect(presentArtworkPurchase(detail())).toEqual({
      priceLabel: "£120",
      vatNote: "Includes VAT",
      availability: "available",
    });
    expect(
      presentArtworkPurchase(detail({ availability: { totalEditions: 24, state: "sold_out" } }))
        ?.availability,
    ).toBe("sold_out");
    expect(presentArtworkPurchase(detail({ printPricePence: null }))).toBeNull();
  });
});

describe("scale drawing", () => {
  it("draws the work at its real size beside a 1.7 m figure", () => {
    const scale = presentArtworkScale(detail({ heightCm: 50, widthCm: 40 }));
    expect(scale).not.toBeNull();
    if (!scale) return;
    expect(scale.artwork.width).toBe(40);
    expect(scale.artwork.height).toBe(50);
    expect(scale.figure.height).toBe(SCALE_FIGURE.height);
    expect(scale.scene.height - scale.figure.y).toBe(SCALE_FIGURE.height);
    // Centred at 150 cm: the bottom edge sits 125 cm above the floor.
    expect(scale.scene.height - (scale.artwork.y + scale.artwork.height)).toBe(125);
    expect(scale.caption).toBe("50 × 40 cm, drawn to scale beside a 1.7 m figure.");
  });

  it("keeps a large work on the wall and widens the wall to fit it", () => {
    const scale = presentArtworkScale(detail({ heightCm: 150, widthCm: 320 }));
    if (!scale) throw new Error("expected a drawing");
    expect(scale.scene.height - (scale.artwork.y + scale.artwork.height)).toBe(75);
    expect(scale.scene.width).toBeGreaterThanOrEqual(320);
  });

  it("is left out without a usable size", () => {
    expect(presentArtworkScale(detail({ heightCm: 50, widthCm: null }))).toBeNull();
    expect(presentArtworkScale(detail({ heightCm: 5000, widthCm: 40 }))).toBeNull();
  });
});

describe("product structured data", () => {
  it("offers the VAT-inclusive GBP price with availability, delivery and returns", () => {
    const [product, breadcrumbs] = artworkProductJsonLd(
      detail({ description: "A still life." }),
      new URL("https://shop.thelax.art/"),
    );
    expect(product).toMatchObject({
      "@type": "Product",
      name: "Warm Basket by Emmett King",
      url: "https://shop.thelax.art/artworks/warm-basket",
      image: ["https://shop.thelax.art/warm-basket.webp"],
      offers: {
        "@type": "Offer",
        price: "120.00",
        priceCurrency: "GBP",
        availability: "https://schema.org/InStock",
        priceSpecification: { valueAddedTaxIncluded: true, price: "120.00" },
        shippingDetails: { shippingRate: { value: "15.00", currency: "GBP" } },
        hasMerchantReturnPolicy: { merchantReturnDays: 14 },
        seller: { name: "LAX Shop", legalName: "London Art Exchange Ltd" },
      },
    });
    expect(breadcrumbs?.["@type"]).toBe("BreadcrumbList");
    const [soldOut] = artworkProductJsonLd(
      detail({ availability: { totalEditions: 24, state: "sold_out" } }),
      new URL("https://shop.thelax.art/"),
    );
    expect((soldOut?.offers as { availability: string }).availability).toBe(
      "https://schema.org/SoldOut",
    );
  });
});
