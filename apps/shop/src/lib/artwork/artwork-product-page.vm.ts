import {
  type ArtworkPurchaseVm,
  artworkIncludedItems,
  presentArtworkPurchase,
} from "@/lib/presenters/artwork-purchase.presenter";
import { type ArtworkScaleVm, presentArtworkScale } from "@/lib/presenters/artwork-scale.presenter";
import {
  type ArtworkSpecRow,
  artworkSizeSummary,
  presentArtworkSpecs,
} from "@/lib/presenters/artwork-specs.presenter";
import type { PublicArtworkDetail, PublicArtworkSummary } from "@auction/shop-contracts";

/*
 * How a Shop product page reads: the gallery, the buy block, the details and the links out to the
 * artist and the original on lax.art. Pure, so it is tested without rendering.
 */

export type ArtworkGalleryImageVm = { url: string; alt: string };

export type ArtworkGalleryVm = {
  images: ArtworkGalleryImageVm[];
  /** A to-scale drawing, offered after the photographs; null without a usable size. */
  scale: ArtworkScaleVm | null;
};

export type ArtworkCrossLinksVm = {
  /** "About the artist on lax.art"; null when lax.art is not configured here. */
  artistOnArtHref: string | null;
  /** "See the original at lax.art"; only while the linked original is live there. */
  originalOnArtHref: string | null;
};

export type ArtworkProductPageVm = {
  slug: string;
  title: string;
  artistName: string;
  /** The artist's page on Shop: their editions. */
  artistHref: string;
  /** "50 × 40 cm (19.7 × 15.7 in)" under the title; null when the size is not catalogued. */
  sizeSummary: string | null;
  gallery: ArtworkGalleryVm;
  /** Null when the edition has no price yet, so it cannot be bought. */
  purchase: ArtworkPurchaseVm | null;
  specs: ArtworkSpecRow[];
  description: string | null;
  included: string[];
  crossLinks: ArtworkCrossLinksVm;
  /** "Editions by {artist}": other editions, available ones first. */
  related: { title: string; viewAllHref: string; items: PublicArtworkSummary[] };
};

export const RELATED_EDITIONS_LIMIT = 4;

export function artworkImageAlt(artwork: Pick<PublicArtworkDetail, "title" | "artistName">) {
  return `${artwork.title} by ${artwork.artistName}`;
}

/** Every image the API returns, in order; the primary image alone for older records. */
export function buildGalleryImages(artwork: PublicArtworkDetail): ArtworkGalleryImageVm[] {
  const fallbackAlt = artworkImageAlt(artwork);
  const seen = new Set<string>();
  const images: ArtworkGalleryImageVm[] = [];
  for (const image of artwork.images ?? []) {
    if (!image.url || seen.has(image.url)) continue;
    seen.add(image.url);
    images.push({ url: image.url, alt: image.alt?.trim() || fallbackAlt });
  }
  if (images.length === 0 && artwork.imageUrl) {
    images.push({ url: artwork.imageUrl, alt: fallbackAlt });
  }
  return images;
}

/**
 * Other editions by the artist, the page's own work left out, available ones first. A sold-out
 * page offers only editions that can still be bought.
 */
export function selectRelatedEditions(
  slug: string,
  items: readonly PublicArtworkSummary[],
  options: { availableOnly: boolean },
): PublicArtworkSummary[] {
  const others = items.filter((item) => item.slug !== slug && item.eligibleForEditionAllocation);
  const available = others.filter((item) => item.availability.state === "available");
  const soldOut = options.availableOnly
    ? []
    : others.filter((item) => item.availability.state !== "available");
  return [...available, ...soldOut].slice(0, RELATED_EDITIONS_LIMIT);
}

function artUrl(artBaseUrl: URL | null, path: string): string | null {
  return artBaseUrl ? new URL(path, artBaseUrl).toString() : null;
}

export function buildArtworkProductPage(input: {
  artwork: PublicArtworkDetail;
  /** The artist's other Shop editions (may include this one). */
  artistEditions: readonly PublicArtworkSummary[];
  artBaseUrl: URL | null;
}): ArtworkProductPageVm {
  const { artwork, artBaseUrl } = input;
  const artistSlug = encodeURIComponent(artwork.artistSlug);
  return {
    slug: artwork.slug,
    title: artwork.title,
    artistName: artwork.artistName,
    artistHref: `/artists/${artistSlug}`,
    sizeSummary: artworkSizeSummary(artwork),
    gallery: { images: buildGalleryImages(artwork), scale: presentArtworkScale(artwork) },
    purchase: presentArtworkPurchase(artwork),
    specs: presentArtworkSpecs(artwork),
    description: artwork.description?.trim() || null,
    included: artworkIncludedItems(artwork),
    crossLinks: {
      artistOnArtHref: artUrl(artBaseUrl, `/artists/${artistSlug}`),
      originalOnArtHref: artwork.sourceOriginalSlug
        ? artUrl(artBaseUrl, `/artworks/${encodeURIComponent(artwork.sourceOriginalSlug)}`)
        : null,
    },
    related: {
      title: `Editions by ${artwork.artistName}`,
      viewAllHref: `/artists/${artistSlug}`,
      items: selectRelatedEditions(artwork.slug, input.artistEditions, {
        availableOnly: artwork.availability.state === "sold_out" || artwork.saleState === "sold",
      }),
    },
  };
}
