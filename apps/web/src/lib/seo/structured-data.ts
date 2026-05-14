import {
  SITE_ALTERNATE_NAMES,
  SITE_BUSINESS_ADDRESS,
  SITE_CONTACT_EMAIL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_TELEPHONE_SCHEMA,
} from "@/lib/brand";
import { lotPath, salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot, Sale } from "@auction/types";

function lotCurrency(auction: Lot): string {
  const explicit = auction.marketingDetails?.estimate?.currency;
  if (explicit && /^[A-Z]{3}$/.test(explicit)) return explicit;
  return "GBP";
}

export function lotProductJsonLd(
  auction: Lot,
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
      priceCurrency: lotCurrency(auction),
      price: auction.currentPrice,
      availability,
      priceValidUntil: auction.endTime.toISOString(),
      ...(opts.sellerName ? { seller: { "@type": "Organization", name: opts.sellerName } } : {}),
    },
  };
}

/** Sale events render as virtual auction-style events. `eventStatus` mirrors the
 * sale's lifecycle so Google's rich result understands current state.
 */
export function saleEventJsonLd(sale: Sale): Record<string, unknown> {
  const base = getSiteUrl();
  const url = `${base}${salePath(sale)}`;
  const status =
    sale.status === "active"
      ? "https://schema.org/EventScheduled"
      : sale.status === "ended"
        ? "https://schema.org/EventCompleted"
        : "https://schema.org/EventScheduled";
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: sale.title,
    description: sale.description ?? undefined,
    startDate: sale.startTime.toISOString(),
    endDate: sale.endTime.toISOString(),
    eventStatus: status,
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    organizer: { "@type": "Organization", name: SITE_NAME, url: base },
    location: {
      "@type": "VirtualLocation",
      url,
    },
    url,
  };
}

/** Home page root document (pairs with `breadcrumbJsonLd` via optional `@id` link). */
export function webPageJsonLd(opts: {
  url: string;
  name: string;
  description?: string;
  breadcrumbId?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: opts.url,
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.breadcrumbId ? { breadcrumb: { "@id": opts.breadcrumbId } } : {}),
  };
}

/** `ItemList` of `Event` entries for upcoming sales on the marketing home page. */
export function homeUpcomingItemListJsonLd(sales: Sale[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: sales.map((sale, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: saleEventJsonLd(sale),
    })),
  };
}

export function faqPageJsonLd(
  items: { question: string; answer: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function visualArtistJsonLd(opts: {
  name: string;
  url: string;
  image?: string;
  description?: string;
  sameAs?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": ["Person", "VisualArtist"],
    name: opts.name,
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.sameAs && opts.sameAs.length > 0 ? { sameAs: opts.sameAs } : {}),
  };
}

export function organizationJsonLd(): Record<string, unknown> {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: base,
    description: SITE_TAGLINE,
    logo: `${base}/logo.svg`,
    address: {
      "@type": "PostalAddress",
      ...SITE_BUSINESS_ADDRESS,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SITE_CONTACT_EMAIL,
        telephone: SITE_TELEPHONE_SCHEMA,
        areaServed: "GB",
        availableLanguage: ["English"],
      },
    ],
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
    alternateName: SITE_ALTERNATE_NAMES,
    url: base,
    description: SITE_TAGLINE,
    address: {
      "@type": "PostalAddress",
      ...SITE_BUSINESS_ADDRESS,
    },
    telephone: SITE_TELEPHONE_SCHEMA,
    email: SITE_CONTACT_EMAIL,
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
    alternateName: SITE_ALTERNATE_NAMES,
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

export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
  opts?: { graphId?: string },
): Record<string, unknown> {
  const base = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    ...(opts?.graphId ? { "@id": opts.graphId } : {}),
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
