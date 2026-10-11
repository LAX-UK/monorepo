import {
  formatArtworkMetaLine,
  isArtworkEnquiryAvailable,
  resolveArtworkPriceLabel,
} from "@/lib/presenters/artwork-commerce.presenter";
import type { PortalSavedArtwork, PublicArtworkSummary } from "@auction/shop-contracts";

export type CatalogueArtworkCardVm = {
  slug: string;
  title: string;
  artistName: string;
  artistHref: string;
  imageUrl: string | null;
  imageAlt: string;
  /** “year · medium · dimensions”; null hides the line. */
  metaLine: string | null;
  /** “£850.00”, “Price on request”, “Sold”; null when unknown (saved items). */
  priceLabel: string | null;
  href: string;
  /** Opens the enquiry sheet on the detail page; null when the work is sold. */
  enquireHref: string | null;
  saved: boolean;
};

export function artworkHref(slug: string): string {
  return `/artworks/${encodeURIComponent(slug)}`;
}

export function artworkEnquireHref(slug: string): string {
  return `${artworkHref(slug)}?enquire=1`;
}

export function artistHref(slug: string): string {
  return `/artists/${encodeURIComponent(slug)}`;
}

export function toCatalogueArtworkCardVm(
  item: PublicArtworkSummary,
  savedSlugs: ReadonlySet<string> = new Set(),
): CatalogueArtworkCardVm {
  return {
    slug: item.slug,
    title: item.title,
    artistName: item.artistName,
    artistHref: artistHref(item.artistSlug),
    imageUrl: item.imageUrl,
    imageAlt: `${item.title} by ${item.artistName}`,
    metaLine: formatArtworkMetaLine(item),
    priceLabel: resolveArtworkPriceLabel(item),
    href: artworkHref(item.slug),
    enquireHref: isArtworkEnquiryAvailable(item) ? artworkEnquireHref(item.slug) : null,
    saved: savedSlugs.has(item.slug),
  };
}

export function buildCatalogueArtworkCards(
  items: readonly PublicArtworkSummary[],
  savedSlugs: ReadonlySet<string> = new Set(),
): CatalogueArtworkCardVm[] {
  return items.map((item) => toCatalogueArtworkCardVm(item, savedSlugs));
}

/** Saved favorites carry no sale facts; the detail page resolves price and availability. */
export function toSavedArtworkCardVm(item: PortalSavedArtwork): CatalogueArtworkCardVm {
  return {
    slug: item.artworkSlug,
    title: item.artworkTitle,
    artistName: item.artistName,
    artistHref: artistHref(item.artistSlug),
    imageUrl: item.imageUrl,
    imageAlt: `${item.artworkTitle} by ${item.artistName}`,
    metaLine: null,
    priceLabel: null,
    href: artworkHref(item.artworkSlug),
    enquireHref: artworkEnquireHref(item.artworkSlug),
    saved: true,
  };
}

/** lax.art lists only works sold through the art channel. */
export function buildSavedArtworkCards(
  items: readonly PortalSavedArtwork[],
): CatalogueArtworkCardVm[] {
  return items.filter((item) => item.salesChannel === "art").map(toSavedArtworkCardVm);
}
