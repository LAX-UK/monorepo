import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot } from "@auction/types";

export function lotProductJsonLd(auction: Lot): Record<string, unknown> {
  const base = getSiteUrl();
  const url = `${base}/artwork/${auction.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: auction.title,
    description: auction.description ?? undefined,
    image: auction.images.length ? auction.images : undefined,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      price: auction.currentPrice,
      availability: "https://schema.org/InStock",
    },
  };
}

export function organizationJsonLd(): Record<string, unknown> {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: base,
    description: SITE_TAGLINE,
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: base,
    description: SITE_TAGLINE,
    publisher: { "@type": "Organization", name: SITE_NAME, url: base },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function itemListJsonLd(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${base}${item.path.startsWith("/") ? item.path : `/${item.path}`}`,
    })),
  };
}
