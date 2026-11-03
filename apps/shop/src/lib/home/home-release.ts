import { isCatalogueArtworkSoldOut } from "@/lib/catalogue/catalogue-artwork-card.vm";
import { formatReleaseDate, isNewRelease } from "@/lib/catalogue/edition-release";
import type { ShopImageFacts } from "@/lib/home/home-image-facts";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import {
  type FeaturedPrintFacts,
  type HomeReleaseChoice,
  chooseHomeRelease,
} from "@auction/shop-domain";

/** How the home finds the photograph an edition can be shown with. */
export type HomePhotographs = {
  /** The address a work's photograph is shown from, or null without one. */
  imageSrc: (item: PublicArtworkSummary) => string | null;
  /** What was read from each photograph, by the address it is shown from. */
  imageFacts: ReadonlyMap<string, ShopImageFacts>;
};

/**
 * True when the edition has a photograph that can be shown: it has an address and the server could
 * read the picture. An edition listing an image that cannot be loaded would put the cover on an
 * empty panel, so it does not count as having one.
 */
export function hasShowablePhotograph(
  item: PublicArtworkSummary,
  photos: HomePhotographs,
): boolean {
  const src = photos.imageSrc(item);
  return src !== null && photos.imageFacts.has(src);
}

/**
 * What the release rule reads from an edition the Shop lists. Everything the storefront reads is
 * already live, so only stock and a photograph that can be shown decide.
 */
function releaseFacts(item: PublicArtworkSummary, photos: HomePhotographs): FeaturedPrintFacts {
  return {
    live: true,
    soldOut: isCatalogueArtworkSoldOut(item),
    hasImage: hasShowablePhotograph(item, photos),
  };
}

/**
 * The release in the first screen, by the shop-domain rule LAX Admin's Featured on home also
 * shows: the first staff-placed edition that can lead, otherwise the newest one on sale. An
 * edition without a photograph that can be shown never leads: the next one does, and with none
 * the cover is type.
 */
export function selectHomeRelease(
  featured: readonly PublicArtworkSummary[],
  newest: readonly PublicArtworkSummary[],
  photos: HomePhotographs,
): HomeReleaseChoice<PublicArtworkSummary> | null {
  return chooseHomeRelease(featured, newest, (item) => releaseFacts(item, photos));
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

/** True inside the new-release window, which is what "A new limited edition" may claim. */
export function isNewReleaseChoice(
  choice: HomeReleaseChoice<PublicArtworkSummary>,
  now: Date,
): boolean {
  return (
    formatReleaseDate(choice.item.listedAt) !== null && isNewRelease(choice.item.listedAt, now)
  );
}

/**
 * The photographs the first screen and the wall may show: every edition the release can be chosen
 * from, so the choice can skip one whose picture cannot be read.
 */
export function homePhotographAddresses(
  data: {
    featured: readonly PublicArtworkSummary[];
    editions: readonly PublicArtworkSummary[];
  },
  addressOf: (item: PublicArtworkSummary) => string | null,
): string[] {
  return [...data.featured, ...data.editions].flatMap((item) => addressOf(item) ?? []);
}
