import type {
  ArtEditorialVenueDetail,
  ArtEditorialVenueSummary,
} from "@/lib/editorial/art-editorial.types";
import { venueAddressParts, venueHref } from "@/lib/editorial/editorial-pages.composer";

export type ArtHomeGalleryCardVm = {
  key: string;
  href: string;
  name: string;
  /** Street, then postcode, as Figma sets them on two lines; empty when the detail read failed. */
  addressLines: string[];
  imageUrl: string | null;
};

/** A listed venue with its detail, or null when the detail read failed. */
export type ArtHomeVenueEntry = {
  summary: ArtEditorialVenueSummary;
  detail: ArtEditorialVenueDetail | null;
};

export function buildArtHomeGalleryCards(
  entries: readonly ArtHomeVenueEntry[],
): ArtHomeGalleryCardVm[] {
  return entries.map(({ summary, detail }) => ({
    key: summary.slug,
    href: venueHref(summary.slug),
    name: summary.name,
    addressLines: detail ? venueAddressParts(detail) : [],
    imageUrl: summary.coverUrl,
  }));
}
