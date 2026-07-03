import { coerceToIsoString } from "@/lib/data/http/parse";
import { resolveLotCurrency } from "@/lib/money/currency";
import { lotPath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot, PublicLotView } from "@auction/types";

export function lotProductJsonLd(
  auction: Lot | PublicLotView,
  opts: { artistName?: string; sellerName?: string } = {},
): Record<string, unknown> {
  const base = getSiteUrl();
  const url = `${base}${lotPath(auction)}`;
  const availability =
    auction.status === "ended"
      ? "https://schema.org/SoldOut"
      : auction.status === "active"
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder";
  const priceValidUntil = coerceToIsoString(auction.endTime);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: auction.title,
    description: auction.description ?? undefined,
    image: auction.images.length ? auction.images : undefined,
    ...(opts.artistName ? { brand: { "@type": "Brand", name: opts.artistName } } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: resolveLotCurrency(auction),
      price: auction.currentPrice,
      availability,
      ...(priceValidUntil ? { priceValidUntil } : {}),
      ...(opts.sellerName ? { seller: { "@type": "Organization", name: opts.sellerName } } : {}),
    },
  };
}
