import {
  SITE_ALTERNATE_NAMES,
  SITE_BUSINESS_ADDRESS,
  SITE_CONTACT_EMAIL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_TELEPHONE_SCHEMA,
} from "@/lib/brand";
import { coerceToIsoString } from "@/lib/data/http/parse";
import { resolveLotCurrency } from "@/lib/money/currency";
import { lotPath, salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import { type ArtistKind, getCreatorKindConfig } from "@auction/types";
import type { Lot, PublicLotView, Sale, SaleDayMedia } from "@auction/types";

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
  const startDate = coerceToIsoString(sale.startTime);
  const endDate = coerceToIsoString(sale.endTime);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: sale.title,
    description: sale.description ?? undefined,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    eventStatus: status,
    eventAttendanceMode: location.attendanceMode,
    organizer: { "@type": "Organization", name: SITE_NAME, url: base },
    location: location.location,
    url,
  };
}

/**
 * Schema.org `VideoObject` for an archived saleroom recording.
 * Only emit this when the sale has ended, the stream URL is embeddable (so
 * `embedUrl` is present), and the stream provider is known.
 * Pass `null` for `embedUrl` when the URL is not embeddable — callers should
 * skip emitting this in that case.
 */
export function saleRecordingVideoJsonLd(
  sale: Sale,
  embedUrl: string,
  posterUrl: string | null,
): Record<string, unknown> {
  const base = getSiteUrl();
  const uploadDate = coerceToIsoString(sale.endTime) ?? coerceToIsoString(sale.startTime);
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${sale.title} — saleroom recording`,
    description: sale.description ?? `Watch the complete ${sale.title} auction as it happened.`,
    embedUrl,
    ...(uploadDate ? { uploadDate } : {}),
    ...(posterUrl ? { thumbnailUrl: posterUrl } : {}),
    url: `${base}${salePath(sale)}`,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: base,
    },
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
  const datedSales = sales.filter(
    (sale) => coerceToIsoString(sale.startTime) && coerceToIsoString(sale.endTime),
  );
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: datedSales.map((sale, i) => ({
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

/**
 * Schema.org `ImageGallery` with `ImageObject`/`VideoObject` entries for auction-day media.
 * Only emit when the sale has ended, delivery mode is onsite/hybrid, and media exists.
 * Each item gets `contentUrl` (absolute), `name` (caption or fallback), `width`, `height`.
 * The first item also carries `representativeOfPage: true`.
 */
export function saleDayGalleryJsonLd(
  sale: Sale,
  media: SaleDayMedia[],
): Record<string, unknown> | null {
  if (media.length === 0) return null;
  const base = getSiteUrl();
  const saleUrl = `${base}${salePath(sale)}`;
  const endDate = coerceToIsoString(sale.endTime);
  const absUrl = (src: string) =>
    src.startsWith("http") ? src : `${base}/${src.replace(/^\//, "")}`;

  let imageN = 0;
  const mediaObjects = media.map((item, i) => {
    if (item.mediaType === "video") {
      return {
        "@type": "VideoObject",
        contentUrl: absUrl(item.src),
        name: item.caption?.trim() || `${sale.title} — auction day video`,
        description: item.caption?.trim() || `Video from the ${sale.title} auction.`,
        ...(endDate ? { uploadDate: endDate } : {}),
        ...(item.posterSrc ? { thumbnailUrl: absUrl(item.posterSrc) } : {}),
        ...(item.width ? { width: String(item.width) } : {}),
        ...(item.height ? { height: String(item.height) } : {}),
        ...(i === 0 ? { representativeOfPage: true } : {}),
      };
    }
    imageN += 1;
    return {
      "@type": "ImageObject",
      contentUrl: absUrl(item.src),
      name:
        item.caption?.trim() || item.alt?.trim() || `${sale.title} — auction day photo ${imageN}`,
      ...(item.alt ? { description: item.alt } : {}),
      ...(item.width ? { width: String(item.width) } : {}),
      ...(item.height ? { height: String(item.height) } : {}),
      ...(i === 0 ? { representativeOfPage: true } : {}),
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: `${sale.title} — Auction Day`,
    url: `${saleUrl}#gallery`,
    associatedMedia: mediaObjects,
  };
}

/**
 * Schema.org `ItemList` wrapping external press coverage on sale pages.
 * Re-exported from the press SEO module for backward compatibility.
 */
export { salePressJsonLd } from "@/lib/seo/press/jsonld";

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
