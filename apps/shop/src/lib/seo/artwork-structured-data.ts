import { type JsonLd, breadcrumbJsonLd } from "@auction/branding";
import type { PublicArtworkDetail } from "@auction/shop-contracts";
import { FULFILMENT_SURCHARGE_PENCE } from "@auction/shop-domain";

const SCHEMA = "https://schema.org";
const SHOP_NAME = "LAX Shop";

function absolute(siteUrl: URL, pathOrUrl: string): string {
  return new URL(pathOrUrl, siteUrl).toString();
}

function pounds(pence: number): string {
  return (pence / 100).toFixed(2);
}

function compact(record: Record<string, unknown>): JsonLd {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value != null));
}

function offer(artwork: PublicArtworkDetail, url: string): JsonLd | undefined {
  if (artwork.printPricePence === null) return undefined;
  const soldOut = artwork.saleState === "sold" || artwork.availability.state === "sold_out";
  const price = pounds(artwork.printPricePence);
  return {
    "@type": "Offer",
    url,
    price,
    priceCurrency: "GBP",
    // UK prices include VAT.
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price,
      priceCurrency: "GBP",
      valueAddedTaxIncluded: true,
    },
    availability: `${SCHEMA}/${soldOut ? "SoldOut" : "InStock"}`,
    itemCondition: `${SCHEMA}/NewCondition`,
    seller: { "@type": "Organization", name: SHOP_NAME },
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: {
        "@type": "MonetaryAmount",
        value: pounds(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery),
        currency: "GBP",
      },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "GB" },
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "GB",
      returnPolicyCategory: `${SCHEMA}/MerchantReturnFiniteReturnWindow`,
      merchantReturnDays: 14,
    },
  };
}

/** Product (with its Offer: VAT-inclusive GBP price and availability) and its breadcrumb trail. */
export function artworkProductJsonLd(artwork: PublicArtworkDetail, siteUrl: URL): JsonLd[] {
  const path = `/artworks/${encodeURIComponent(artwork.slug)}`;
  const url = absolute(siteUrl, path);
  const images = [
    ...new Set(
      [...(artwork.images ?? []).map((image) => image.url), artwork.imageUrl]
        .filter((image): image is string => Boolean(image))
        .map((image) => absolute(siteUrl, image)),
    ),
  ];
  return [
    compact({
      "@context": SCHEMA,
      "@type": "Product",
      "@id": `${url}#product`,
      name: `${artwork.title} by ${artwork.artistName}`,
      sku: artwork.slug,
      url,
      image: images.length > 0 ? images : undefined,
      description: artwork.description ?? undefined,
      category: "Limited edition print",
      offers: offer(artwork, url),
    }),
    breadcrumbJsonLd(siteUrl.origin, [
      { name: "Shop", path: "/" },
      { name: "Artworks", path: "/artworks" },
      { name: artwork.title, path },
    ]),
  ];
}
