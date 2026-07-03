import { SITE_NAME } from "@/lib/brand";
import { coerceToIsoString } from "@/lib/data/http/parse";
import { salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Sale, SaleDayMedia } from "@auction/types";
import { nonEmpty } from "./utils";

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
