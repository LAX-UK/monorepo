import { artStorefrontLoginHref } from "@/lib/art-viewer-state";
import {
  type CatalogueArtworkCardVm,
  artistHref,
  artworkHref,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type { ArtCataloguePort, ArtFavoritesReadPort, ArtViewerPort } from "@/lib/ports";
import {
  type ArtworkAvailabilityView,
  presentArtworkAvailability,
} from "@/lib/presenters/artwork-availability.presenter";
import {
  formatArtworkMetaLine,
  isArtworkEnquiryAvailable,
  resolveArtworkPriceLabel,
} from "@/lib/presenters/artwork-commerce.presenter";
import {
  type ArtworkSpecGroups,
  artworkCertificateLine,
  buildArtworkSpecGroups,
} from "@/lib/presenters/artwork-spec.presenter";
import { artworkJsonLd } from "@/lib/seo/art-structured-data";
import { seoMetadataDescription, seoMetadataTitle } from "@/lib/seo/seo-metadata";
import type { JsonLd } from "@auction/branding";
import type { PublicArtworkDetail, PublicArtworkSummary } from "@auction/shop-contracts";

export type ArtEnquiryContact = {
  name: string;
  email: string;
  phone: string;
};

export type ArtworkEnquiryVm =
  | { kind: "unavailable" }
  | { kind: "sign_in"; loginHref: string }
  | { kind: "account_unavailable"; message: string }
  | { kind: "ready"; contact: ArtEnquiryContact; autoOpen: boolean };

export type ArtworkGalleryImageVm = { url: string; alt: string };

export type ArtworkDetailVm = {
  slug: string;
  title: string;
  kindLabel: "Original" | "Edition";
  artistName: string;
  artistHref: string;
  imageUrl: string | null;
  imageAlt: string;
  galleryImages: ArtworkGalleryImageVm[];
  priceLabel: string;
  metaLine: string | null;
  description: string | null;
  specs: ArtworkSpecGroups;
  certificateLine: string | null;
  provenance: string | null;
  exhibitionHistory: string | null;
  relatedArtworks: CatalogueArtworkCardVm[];
  /** Heading and "View all" target matching where the related works came from. */
  relatedSection: { title: string; viewAllHref: string; viewAllSrLabel: string };
  availability: ArtworkAvailabilityView;
  enquiry: ArtworkEnquiryVm;
  saved: boolean;
  favoriteAuth: ArtFavoriteAuth;
  structuredData: JsonLd[];
};

export type ArtworkDetailPageResult =
  | { kind: "ok"; vm: ArtworkDetailVm }
  | { kind: "not_found" }
  | { kind: "unavailable" };

export function artworkEnquiryReturnTo(slug: string): string {
  return `${artworkHref(slug)}?enquire=1`;
}

function resolveEnquiry(
  artwork: PublicArtworkDetail,
  viewer: Awaited<ReturnType<ArtViewerPort["load"]>>,
  enquireRequested: boolean,
): ArtworkEnquiryVm {
  if (!isArtworkEnquiryAvailable(artwork)) return { kind: "unavailable" };
  switch (viewer.kind) {
    case "authenticated":
      return {
        kind: "ready",
        contact: {
          name: viewer.displayName ?? "",
          email: viewer.email ?? "",
          phone: viewer.verifiedPhone ?? "",
        },
        autoOpen: enquireRequested,
      };
    case "guest":
      return {
        kind: "sign_in",
        loginHref: artStorefrontLoginHref(artworkEnquiryReturnTo(artwork.slug)),
      };
    case "disabled":
    case "unavailable":
      return { kind: "account_unavailable", message: viewer.message };
  }
}

export async function composeArtworkDetailPage(
  services: { catalogue: ArtCataloguePort; viewer: ArtViewerPort; favorites: ArtFavoritesReadPort },
  input: { slug: string; enquireRequested: boolean; siteUrl: URL },
): Promise<ArtworkDetailPageResult> {
  const favoritesPromise = loadViewerFavoriteContext(services, artworkHref(input.slug));
  let artwork: PublicArtworkDetail | null;
  try {
    artwork = await services.catalogue.getArtwork(input.slug);
  } catch {
    await favoritesPromise;
    return { kind: "unavailable" };
  }
  const relatedPromise =
    artwork != null
      ? loadRelatedArtworks(services.catalogue, artwork)
      : Promise.resolve<RelatedArtworks>({ items: [], fromCollection: false });
  const favorites = await favoritesPromise;
  if (!artwork) return { kind: "not_found" };
  const relatedPage = await relatedPromise;
  const galleryImages = buildGalleryImages(artwork);

  return {
    kind: "ok",
    vm: {
      slug: artwork.slug,
      title: artwork.title,
      kindLabel: artwork.eligibleForEditionAllocation ? "Edition" : "Original",
      artistName: artwork.artistName,
      artistHref: artistHref(artwork.artistSlug),
      imageUrl: artwork.imageUrl,
      imageAlt: `${artwork.title} by ${artwork.artistName}`,
      galleryImages,
      priceLabel: resolveArtworkPriceLabel(artwork),
      metaLine: formatArtworkMetaLine(artwork),
      description: artwork.description,
      specs: buildArtworkSpecGroups(artwork),
      certificateLine: artworkCertificateLine(artwork),
      provenance: artwork.provenance ?? null,
      exhibitionHistory: artwork.exhibitionHistory ?? null,
      relatedArtworks: buildCatalogueArtworkCards(relatedPage.items, favorites.savedArtworkSlugs),
      relatedSection: relatedPage.fromCollection
        ? { title: "More in this collection", viewAllHref: "/artworks", viewAllSrLabel: "artworks" }
        : {
            title: `More by ${artwork.artistName}`,
            viewAllHref: artistHref(artwork.artistSlug),
            viewAllSrLabel: `works by ${artwork.artistName}`,
          },
      availability: presentArtworkAvailability(artwork),
      enquiry: resolveEnquiry(artwork, favorites.viewer, input.enquireRequested),
      saved: favorites.savedArtworkSlugs.has(artwork.slug),
      favoriteAuth: favorites.favoriteAuth,
      structuredData: artworkJsonLd(artwork, input.siteUrl),
    },
  };
}

export const RELATED_ARTWORKS_LIMIT = 4;

type RelatedArtworks = { items: PublicArtworkSummary[]; fromCollection: boolean };

/** Same-category works first (`relatedTo`), topped up with the artist's other works. */
async function loadRelatedArtworks(
  catalogue: ArtCataloguePort,
  artwork: PublicArtworkDetail,
): Promise<RelatedArtworks> {
  const [byCategory, byArtist] = await Promise.all([
    catalogue
      .listArtworks({ relatedTo: artwork.slug, limit: RELATED_ARTWORKS_LIMIT + 1 })
      .catch(() => ({ items: [] })),
    catalogue
      .listArtworks({ artistSlug: artwork.artistSlug, limit: RELATED_ARTWORKS_LIMIT + 1 })
      .catch(() => ({ items: [] })),
  ]);
  const seen = new Set([artwork.slug]);
  const related: PublicArtworkSummary[] = [];
  let fromCollection = false;
  for (const [source, items] of [
    ["collection", byCategory.items],
    ["artist", byArtist.items],
  ] as const) {
    for (const item of items) {
      if (related.length === RELATED_ARTWORKS_LIMIT) break;
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      related.push(item);
      if (source === "collection" && item.artistSlug !== artwork.artistSlug) fromCollection = true;
    }
  }
  return { items: related, fromCollection };
}

function buildGalleryImages(artwork: PublicArtworkDetail): ArtworkGalleryImageVm[] {
  const fromList = (artwork.images ?? [])
    .filter((image) => image.url)
    .map((image) => ({
      url: image.url,
      alt: image.alt ?? `${artwork.title} by ${artwork.artistName}`,
    }));
  if (fromList.length > 0) return fromList;
  if (artwork.imageUrl) {
    return [{ url: artwork.imageUrl, alt: `${artwork.title} by ${artwork.artistName}` }];
  }
  return [];
}

export type ArtworkDetailMetadataVm =
  | {
      kind: "ok";
      title: string;
      description: string;
      canonicalPath: string;
      imageUrl: string | null;
    }
  | { kind: "not_found" }
  | { kind: "unavailable" };

export async function composeArtworkDetailMetadata(
  catalogue: ArtCataloguePort,
  slug: string,
): Promise<ArtworkDetailMetadataVm> {
  try {
    const artwork = await catalogue.getArtwork(slug);
    if (!artwork) return { kind: "not_found" };
    return {
      kind: "ok",
      title: seoMetadataTitle(artwork, artwork.title),
      description:
        seoMetadataDescription(artwork, artwork.description) ??
        `${artwork.title} by ${artwork.artistName} at LAX Art.`,
      canonicalPath: artworkHref(artwork.slug),
      imageUrl: artwork.imageUrl,
    };
  } catch {
    return { kind: "unavailable" };
  }
}
