import {
  type ArtworkPurchaseVm,
  artworkIncludedItems,
  presentArtworkPurchase,
} from "@/lib/presenters/artwork-purchase.presenter";
import { type ArtworkScaleVm, presentArtworkScale } from "@/lib/presenters/artwork-scale.presenter";
import {
  type ArtworkSpecRow,
  artworkSizeLines,
  artworkSizeSummary,
  presentArtworkSpecs,
} from "@/lib/presenters/artwork-specs.presenter";
import type {
  PublicArtistDetail,
  PublicArtworkDetail,
  PublicArtworkSummary,
} from "@auction/shop-contracts";

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

/** One fact in the strip under the title: edition, size and technique. */
export type ArtworkKeyFactVm = { label: string; value: string };

/** The artist, after the details: who made the work, with ways to their editions and story. */
export type ArtworkArtistBlockVm = {
  name: string;
  discipline: string | null;
  /** One short line about the artist; the full story lives on lax.art. */
  summary: string | null;
  portraitUrl: string | null;
  editionsHref: string;
  editionsLabel: string;
  laxArtHref: string | null;
};

export type ArtworkProductPageVm = {
  slug: string;
  title: string;
  artistName: string;
  /** The artist's page on Shop: their editions. */
  artistHref: string;
  /** "50 × 40 cm (19.7 × 15.7 in)" under the title; null when the size is not catalogued. */
  sizeSummary: string | null;
  /** Edition, size and technique at a glance; empty when fewer than two are catalogued. */
  keyFacts: ArtworkKeyFactVm[];
  gallery: ArtworkGalleryVm;
  /** Null when the edition has no price yet, so it cannot be bought. */
  purchase: ArtworkPurchaseVm | null;
  specs: ArtworkSpecRow[];
  description: string | null;
  included: string[];
  crossLinks: ArtworkCrossLinksVm;
  artist: ArtworkArtistBlockVm;
  /** "More by {artist}": other editions, available ones first. */
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

const MIN_KEY_FACTS = 2;

export function buildArtworkKeyFacts(artwork: PublicArtworkDetail): ArtworkKeyFactVm[] {
  const { totalEditions } = artwork.availability;
  // "60 × 40 cm" without the inches, which the details list carries.
  const size = artworkSizeLines(artwork)[0] ?? null;
  const medium = artwork.medium?.trim() || null;
  const facts: ArtworkKeyFactVm[] = [];
  if (totalEditions > 0) facts.push({ label: "Edition", value: `Edition of ${totalEditions}` });
  if (size) facts.push({ label: "Size", value: size });
  if (medium) facts.push({ label: "Technique", value: medium });
  return facts.length >= MIN_KEY_FACTS ? facts : [];
}

function artUrl(artBaseUrl: URL | null, path: string): string | null {
  return artBaseUrl ? new URL(path, artBaseUrl).toString() : null;
}

export function buildArtworkProductPage(input: {
  artwork: PublicArtworkDetail;
  /** The artist's other Shop editions (may include this one). */
  artistEditions: readonly PublicArtworkSummary[];
  artBaseUrl: URL | null;
  /** The artist's Shop profile, when it could be read; the block falls back to the name. */
  artistDetail?: PublicArtistDetail | null;
}): ArtworkProductPageVm {
  const { artwork, artBaseUrl } = input;
  const artistSlug = encodeURIComponent(artwork.artistSlug);
  return {
    slug: artwork.slug,
    title: artwork.title,
    artistName: artwork.artistName,
    artistHref: `/artists/${artistSlug}`,
    sizeSummary: artworkSizeSummary(artwork),
    keyFacts: buildArtworkKeyFacts(artwork),
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
    artist: {
      name: artwork.artistName,
      discipline: input.artistDetail?.discipline ?? null,
      summary: input.artistDetail?.shortBio?.trim() || null,
      portraitUrl: input.artistDetail?.portraitUrl ?? null,
      editionsHref: `/artists/${artistSlug}`,
      editionsLabel: `Editions by ${artwork.artistName}`,
      laxArtHref: artUrl(artBaseUrl, `/artists/${artistSlug}`),
    },
    related: {
      title: `More by ${artwork.artistName}`,
      viewAllHref: `/artists/${artistSlug}`,
      items: selectRelatedEditions(artwork.slug, input.artistEditions, {
        availableOnly: artwork.availability.state === "sold_out" || artwork.saleState === "sold",
      }),
    },
  };
}
