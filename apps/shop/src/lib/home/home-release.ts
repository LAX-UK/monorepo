import { isCatalogueArtworkSoldOut } from "@/lib/catalogue/catalogue-artwork-card.vm";
import { formatReleaseDate, isNewRelease } from "@/lib/catalogue/edition-release";
import type { PublicArtworkSummary } from "@auction/shop-contracts";

/** The release the first screen shows, and whether staff placed it there. */
export type HomeReleaseChoice = { item: PublicArtworkSummary; featured: boolean };

/** A release has to be something to buy and something to see. */
function canLead(item: PublicArtworkSummary): boolean {
  return item.imageUrl !== null && !isCatalogueArtworkSoldOut(item);
}

/**
 * The release in the first screen: the first staff-placed edition that can be bought and has an
 * image, otherwise the newest edition on sale with an image. A sold-out work or one without an
 * image is never chosen; with none left, the first screen has no release.
 */
export function selectHomeRelease(
  featured: readonly PublicArtworkSummary[],
  newest: readonly PublicArtworkSummary[],
): HomeReleaseChoice | null {
  const placed = featured.find(canLead);
  if (placed) return { item: placed, featured: true };
  const fallback = newest.find(canLead);
  return fallback ? { item: fallback, featured: false } : null;
}

/**
 * "New release · 29 Sept 2026" inside the new-release window, "Featured edition" when staff placed
 * it, otherwise nothing: an eyebrow that only says "on sale" says nothing.
 */
export function homeReleaseEyebrow(choice: HomeReleaseChoice, now: Date): string | null {
  const date = formatReleaseDate(choice.item.listedAt);
  if (date && isNewRelease(choice.item.listedAt, now)) return `New release · ${date}`;
  return choice.featured ? "Featured edition" : null;
}
