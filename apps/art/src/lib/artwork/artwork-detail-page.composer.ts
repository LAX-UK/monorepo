import { artStorefrontLoginHref } from "@/lib/art-viewer-state";
import { artistHref, artworkHref } from "@/lib/catalogue/catalogue-artwork-card.vm";
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
import type { PublicArtworkDetail } from "@auction/shop-contracts";

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

export type ArtworkDetailVm = {
  slug: string;
  title: string;
  kindLabel: "Original" | "Edition";
  artistName: string;
  artistHref: string;
  imageUrl: string | null;
  imageAlt: string;
  priceLabel: string;
  metaLine: string | null;
  description: string | null;
  availability: ArtworkAvailabilityView;
  enquiry: ArtworkEnquiryVm;
  saved: boolean;
  favoriteAuth: ArtFavoriteAuth;
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
  input: { slug: string; enquireRequested: boolean },
): Promise<ArtworkDetailPageResult> {
  const favoritesPromise = loadViewerFavoriteContext(services, artworkHref(input.slug));
  let artwork: PublicArtworkDetail | null;
  try {
    artwork = await services.catalogue.getArtwork(input.slug);
  } catch {
    await favoritesPromise;
    return { kind: "unavailable" };
  }
  const favorites = await favoritesPromise;
  if (!artwork) return { kind: "not_found" };

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
      priceLabel: resolveArtworkPriceLabel(artwork),
      metaLine: formatArtworkMetaLine(artwork),
      description: artwork.description,
      availability: presentArtworkAvailability(artwork),
      enquiry: resolveEnquiry(artwork, favorites.viewer, input.enquireRequested),
      saved: favorites.savedArtworkSlugs.has(artwork.slug),
      favoriteAuth: favorites.favoriteAuth,
    },
  };
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
      title: artwork.title,
      description: artwork.description ?? `${artwork.title} by ${artwork.artistName} at LAX Art.`,
      canonicalPath: artworkHref(artwork.slug),
      imageUrl: artwork.imageUrl,
    };
  } catch {
    return { kind: "unavailable" };
  }
}
