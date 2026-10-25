import { artworkProductJsonLd } from "@/lib/seo/artwork-structured-data";
import type { PublicArtworkDetail } from "@auction/shop-contracts";
import { FULFILMENT_SURCHARGE_PENCE } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import {
  SHOP_RETURNS_LINE,
  artworkIncludedItems,
  presentArtworkPurchase,
  shopDeliveryLine,
} from "./artwork-purchase.presenter";
import { SCALE_SOFA, presentArtworkScale } from "./artwork-scale.presenter";
import { presentArtworkSpecs } from "./artwork-specs.presenter";

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

describe("Details list", () => {
  it("lists the catalogued facts in a fixed order, cm and inches for sizes", () => {
    expect(
      presentArtworkSpecs(
        detail({
          medium: "Giclée print",
          printPaper: "Hahnemühle Photo Rag 308gsm",
          printSize: "60 × 50 cm",
          heightCm: 50,
          widthCm: 40,
          yearCreated: 2025,
          hasCertificate: true,
        }),
      ),
    ).toEqual([
      { label: "Edition", lines: ["Limited edition of 24"] },
      { label: "Medium", lines: ["Giclée print"] },
      { label: "Paper", lines: ["Hahnemühle Photo Rag 308gsm"] },
      { label: "Image size", lines: ["50 × 40 cm", "19.7 × 15.7 in"] },
      { label: "Paper size", lines: ["60 × 50 cm"] },
      { label: "Year", lines: ["2025"] },
      { label: "Certificate of authenticity", lines: ["Included"] },
    ]);
  });

  it("never prints a label without a value", () => {
    const rows = presentArtworkSpecs(
      detail({ availability: { totalEditions: 0, state: "available" } }),
    );
    expect(rows).toEqual([]);
    expect(presentArtworkSpecs(detail({ dimensions: "40 × 50 cm" }))).toContainEqual({
      label: "Size",
      lines: ["40 × 50 cm"],
    });
  });
});

describe("buy block copy", () => {
  it("quotes delivery from the checkout surcharges and the 14-day cancellation", () => {
    expect(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery).toBe(1500);
    expect(shopDeliveryLine()).toBe("UK insured delivery £15.00 · Collection in London free");
    expect(SHOP_RETURNS_LINE).toBe("14-day cancellation");
  });

  it("shows the price with VAT included and the edition size, never a count", () => {
    expect(presentArtworkPurchase(detail())).toEqual({
      priceLabel: "£120.00",
      vatNote: "Includes VAT",
      editionSize: "Limited edition of 24",
      availability: "available",
      availabilityLabel: "Available",
      deliveryLine: shopDeliveryLine(),
      returnsLine: "14-day cancellation",
    });
    expect(
      presentArtworkPurchase(detail({ availability: { totalEditions: 24, state: "sold_out" } }))
        ?.availabilityLabel,
    ).toBe("Sold out");
    expect(presentArtworkPurchase(detail({ printPricePence: null }))).toBeNull();
  });

  it("includes the certificate only when the work has one", () => {
    expect(artworkIncludedItems({ hasCertificate: true })[0]).toBe("Certificate of authenticity");
    expect(artworkIncludedItems({ hasCertificate: false })).not.toContain(
      "Certificate of authenticity",
    );
  });
});

describe("scale drawing", () => {
  it("draws the work at its real size above a standard sofa", () => {
    const scale = presentArtworkScale(detail({ heightCm: 50, widthCm: 40 }));
    expect(scale).not.toBeNull();
    if (!scale) return;
    expect(scale.artwork.width).toBe(40);
    expect(scale.artwork.height).toBe(50);
    expect(scale.sofa.width).toBe(SCALE_SOFA.width);
    // Centred at 150 cm: the bottom edge sits 125 cm above the floor.
    expect(scale.scene.height - (scale.artwork.y + scale.artwork.height)).toBe(125);
    expect(scale.caption).toBe("50 × 40 cm, drawn to scale above a 200 cm sofa.");
  });

  it("keeps a large work clear of the sofa and widens the wall to fit it", () => {
    const scale = presentArtworkScale(detail({ heightCm: 150, widthCm: 320 }));
    if (!scale) throw new Error("expected a drawing");
    expect(scale.scene.height - (scale.artwork.y + scale.artwork.height)).toBe(105);
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
