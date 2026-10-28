import { isCatalogueArtworkSoldOut } from "@/lib/catalogue/catalogue-artwork-card.vm";
import { formatReleaseDate, isNewRelease } from "@/lib/catalogue/edition-release";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import {
  type FeaturedPrintFacts,
  type HomeReleaseChoice,
  chooseHomeRelease,
} from "@auction/shop-domain";

/**
 * What the release rule reads from an edition the Shop lists. Everything the storefront reads is
 * already live, so only stock and the image decide.
 */
function releaseFacts(item: PublicArtworkSummary): FeaturedPrintFacts {
  return { live: true, soldOut: isCatalogueArtworkSoldOut(item), hasImage: item.imageUrl !== null };
}

/**
 * The release in the first screen, by the shop-domain rule LAX Admin's Featured on home also
 * shows: the first staff-placed edition that can lead, otherwise the newest one on sale.
 */
export function selectHomeRelease(
  featured: readonly PublicArtworkSummary[],
  newest: readonly PublicArtworkSummary[],
): HomeReleaseChoice<PublicArtworkSummary> | null {
  return chooseHomeRelease(featured, newest, releaseFacts);
}

/**
 * "New release · 29 Sept 2026" inside the new-release window, "Featured edition" when staff placed
 * it, otherwise nothing: an eyebrow that only says "on sale" says nothing.
 */
export function homeReleaseEyebrow(
  choice: HomeReleaseChoice<PublicArtworkSummary>,
  now: Date,
): string | null {
  const date = formatReleaseDate(choice.item.listedAt);
  if (date && isNewRelease(choice.item.listedAt, now)) return `New release · ${date}`;
  return choice.featured ? "Featured edition" : null;
}
