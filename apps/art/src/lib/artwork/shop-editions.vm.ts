import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { formatGbpPence } from "@auction/shop-portal/vm";

/** One LAX Shop edition made from the original on this page ("Editions available in LAX Shop"). */
export type ShopEditionLinkVm = {
  slug: string;
  title: string;
  href: string;
  /** The edition's image, else the original's; null shows the hatched placeholder. */
  imageUrl: string | null;
  /** Named on the placeholder (as initials) when there is no image. */
  artistName: string;
  /** "Limited edition of 24 · Available"; never a remaining count. */
  editionLine: string;
  /** "£120.00", or null when the edition has no price yet. */
  priceLabel: string | null;
};

export const SHOP_EDITIONS_LIMIT = 4;

/** LAX Shop's base URL from the product directory, or null when Shop is not configured here. */
export function shopBaseUrl(links: readonly LaxProductLinkVm[]): URL | null {
  const shop = links.find((link) => link.id === "shop");
  if (!shop) return null;
  try {
    return new URL(shop.href);
  } catch {
    return null;
  }
}

function editionLine(edition: PublicArtworkSummary): string {
  const { totalEditions, state } = edition.availability;
  const size = totalEditions > 0 ? `Limited edition of ${totalEditions}` : "Limited edition";
  return `${size} · ${state === "available" ? "Available" : "Sold out"}`;
}

/**
 * Editions on LAX Shop for the original, linked to their Shop pages. Empty when Shop has no URL in
 * this environment, so the section is left out rather than linking nowhere.
 */
export function buildShopEditionLinks(
  editions: readonly PublicArtworkSummary[],
  shop: URL | null,
  originalImageUrl: string | null = null,
): ShopEditionLinkVm[] {
  if (!shop) return [];
  return editions.slice(0, SHOP_EDITIONS_LIMIT).map((edition) => ({
    slug: edition.slug,
    title: edition.title,
    href: new URL(`/artworks/${encodeURIComponent(edition.slug)}`, shop).toString(),
    imageUrl: edition.imageUrl ?? originalImageUrl,
    artistName: edition.artistName,
    editionLine: editionLine(edition),
    priceLabel: edition.printPricePence === null ? null : formatGbpPence(edition.printPricePence),
  }));
}
