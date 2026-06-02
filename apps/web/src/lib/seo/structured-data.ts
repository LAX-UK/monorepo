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
import { type ArtistKind, getCreatorKindConfig } from "@auction/types";
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

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function saleLocationJsonLd(sale: Sale, url: string): Record<string, unknown> {
  if (sale.deliveryMode !== "onsite") {
    return {
      attendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      location: {
        "@type": "VirtualLocation",
        url,
      },
    };
  }
  return {
    attendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: nonEmpty(sale.locationName) ?? SITE_NAME,
      ...(sale.locationMapUrl ? { url: sale.locationMapUrl } : {}),
      address: {
        "@type": "PostalAddress",
        streetAddress: [nonEmpty(sale.locationAddressLine1), nonEmpty(sale.locationAddressLine2)]
          .filter(Boolean)
          .join(", "),
        addressLocality: nonEmpty(sale.locationCity),
        addressRegion: nonEmpty(sale.locationCounty),
        postalCode: nonEmpty(sale.locationPostcode),
        addressCountry: nonEmpty(sale.locationCountry),
      },
    },
  };
}

/** Sale events render with delivery-mode-specific location. `eventStatus` mirrors the
 * sale's lifecycle so Google's rich result understands current state.
 */
export function saleEventJsonLd(sale: Sale): Record<string, unknown> {
  const base = getSiteUrl();
  const url = `${base}${salePath(sale)}`;
  const location = saleLocationJsonLd(sale, url);
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
    eventAttendanceMode: location.attendanceMode,
    organizer: { "@type": "Organization", name: SITE_NAME, url: base },
    location: location.location,
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
  /** YYYY (or YYYY-MM-DD) string from the registry. */
  birthDate?: string;
  deathDate?: string;
  nationality?: string;
  /** Aliases / akas surfaced as `alternateName`. */
  alternateName?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": ["Person", "VisualArtist"],
    name: opts.name,
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.sameAs && opts.sameAs.length > 0 ? { sameAs: opts.sameAs } : {}),
    ...(opts.birthDate ? { birthDate: opts.birthDate } : {}),
    ...(opts.deathDate ? { deathDate: opts.deathDate } : {}),
    ...(opts.nationality ? { nationality: opts.nationality } : {}),
    ...(opts.alternateName && opts.alternateName.length > 0
      ? { alternateName: opts.alternateName }
      : {}),
  };
}

/** `Brand` / `Organization` JSON-LD for catalogue brand or marque entities. */
export function brandOrOrganizationJsonLd(opts: {
  type: "Brand" | "Organization";
  name: string;
  url: string;
  image?: string;
  description?: string;
  sameAs?: string[];
  alternateName?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": opts.type,
    name: opts.name,
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.sameAs && opts.sameAs.length > 0 ? { sameAs: opts.sameAs } : {}),
    ...(opts.alternateName && opts.alternateName.length > 0
      ? { alternateName: opts.alternateName }
      : {}),
  };
}

/**
 * Kind-driven creator JSON-LD. The schema.org `@type` is selected from the
 * creator-kind config registry (OCP): adding a new kind only updates the
 * registry, never this function. Person-like kinds carry lifespan/nationality;
 * organisation-like kinds emit a Brand/Organization node.
 */
export function creatorJsonLd(opts: {
  kind: ArtistKind | null | undefined;
  name: string;
  url: string;
  image?: string;
  description?: string;
  sameAs?: string[];
  alternateName?: string[];
  birthDate?: string;
  deathDate?: string;
  foundingDate?: string;
  dissolutionDate?: string;
  nationality?: string;
}): Record<string, unknown> {
  const config = getCreatorKindConfig(opts.kind);
  const isPerson = config.lifespanMode === "person";
  // "Manufacturer" is not a standalone schema.org type; fall back to Organization
  // and keep the richer label as `additionalType`.
  const type =
    config.schemaOrgType === "VisualArtist"
      ? ["Person", "VisualArtist"]
      : config.schemaOrgType === "Manufacturer"
        ? "Organization"
        : config.schemaOrgType;
  const additionalType =
    config.schemaOrgType === "Manufacturer" ? "https://schema.org/Manufacturer" : undefined;
  return {
    "@context": "https://schema.org",
    "@type": type,
    ...(additionalType ? { additionalType } : {}),
    name: opts.name,
    url: opts.url,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.sameAs && opts.sameAs.length > 0 ? { sameAs: opts.sameAs } : {}),
    ...(opts.alternateName && opts.alternateName.length > 0
      ? { alternateName: opts.alternateName }
      : {}),
    ...(isPerson && opts.birthDate ? { birthDate: opts.birthDate } : {}),
    ...(isPerson && opts.deathDate ? { deathDate: opts.deathDate } : {}),
    ...(isPerson && opts.nationality ? { nationality: opts.nationality } : {}),
    ...(!isPerson && opts.foundingDate ? { foundingDate: opts.foundingDate } : {}),
    ...(!isPerson && opts.dissolutionDate ? { dissolutionDate: opts.dissolutionDate } : {}),
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

/** Breadcrumb + WebPage + Organization for long-form pages inside `PolicyHubLayout`. */
export function policyHubPageJsonLd(opts: {
  path: string;
  breadcrumbName: string;
  pageName: string;
  description: string;
}): string {
  const base = getSiteUrl();
  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  const url = `${base}${path}`;
  const breadcrumbId = `${url}#breadcrumb`;
  const crumbs = breadcrumbJsonLd(
    [
      { name: "Home", path: "/" },
      { name: opts.breadcrumbName, path },
    ],
    { graphId: breadcrumbId },
  );
  const page = webPageJsonLd({
    url,
    name: opts.pageName,
    description: opts.description,
    breadcrumbId,
  });
  return jsonLdScript(crumbs, page, organizationJsonLd());
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
