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
    logo: `${base}/logo.svg`,
    address: {
      "@type": "PostalAddress",
      streetAddress: "1 Curator Mews",
      addressLocality: "London",
      postalCode: "W1K 1AA",
      addressCountry: "GB",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "concierge@laxauction.house",
        telephone: "+44-20-7946-0958",
        areaServed: "GB",
        availableLanguage: ["English"],
      },
    ],
    sameAs: [`${base}/contact`, `${base}/about`],
  };
}

export function personJsonLd(opts: {
  name: string;
  url: string;
  image?: string;
  description?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: opts.name,
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.description ? { description: opts.description } : {}),
  };
}

export function localBusinessJsonLd(): Record<string, unknown> {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE_NAME,
    url: base,
    description: SITE_TAGLINE,
    address: {
      "@type": "PostalAddress",
      streetAddress: "1 Curator Mews",
      addressLocality: "London",
      postalCode: "W1K 1AA",
      addressCountry: "GB",
    },
    telephone: "+44-20-7946-0958",
    email: "concierge@laxauction.house",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
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

/** Safe inline JSON-LD for `<script type="application/ld+json">` (escapes `<`). */
export function jsonLdScript(...items: Array<Record<string, unknown> | null | undefined>): string {
  const payload = items.filter(Boolean) as Record<string, unknown>[];
  const json =
    payload.length === 0
      ? "{}"
      : payload.length === 1
        ? JSON.stringify(payload[0])
        : JSON.stringify(payload);
  return json.replace(/</g, "\\u003c");
}
