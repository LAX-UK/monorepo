import type { HomeHeroVm } from "@/lib/home/home-page.vm";
import type { CoverPlateMedia, CoverSlide } from "@auction/marketing-ui";
import { neutralCoverSlide } from "@auction/marketing-ui";

/** The release's print photograph and the pale field taken from it. */
export type ShopCoverPlate = {
  width: number;
  height: number;
  blurDataURL?: string;
  /** A pale field taken from the print, so the type on it is dark. */
  field: string;
};

/** The words for a catalogue that could not be read. */
const CATALOGUE_UNAVAILABLE = {
  title: "The editions can’t be shown right now",
  fact: "Please try again in a moment.",
  primary: { label: "Browse editions", href: "/artworks" },
} as const;

/** The plate, when the release has a photograph and its measured field. */
export function plateFromRelease(
  release: HomeHeroVm["release"],
  plate: ShopCoverPlate | null,
): CoverPlateMedia | null {
  if (!release || !plate) return null;
  return {
    kind: "plate",
    alt: release.imageAlt,
    side: "left",
    src: release.imageUrl,
    width: plate.width,
    height: plate.height,
    ...(plate.blurDataURL ? { blurDataURL: plate.blurDataURL } : {}),
    field: plate.field,
    tone: "dark",
  };
}

/**
 * Maps the Shop home hero to the cover. The release leads when it has a photograph (a plate on
 * a pale field); without one the cover is type. With no edition on sale the one way on from
 * the first screen is the action, and with nothing at all the cover says so plainly.
 */
export function toShopCoverSlide(
  hero: HomeHeroVm,
  options: { plate: ShopCoverPlate | null; catalogueFailed?: boolean } = { plate: null },
): CoverSlide {
  if (options.catalogueFailed) return neutralCoverSlide(CATALOGUE_UNAVAILABLE);
  const primary = hero.primary ?? hero.emptyAction;
  if (!primary) return neutralCoverSlide(CATALOGUE_UNAVAILABLE);
  const plate = plateFromRelease(hero.release, options.plate);
  return {
    id: "shop-home",
    ...(hero.eyebrow ? { time: hero.eyebrow } : {}),
    title: hero.title,
    fact: hero.lead,
    primary,
    ...(hero.workLink ? { link: hero.workLink } : {}),
    ...(hero.release && plate
      ? { credit: { text: hero.release.line, href: hero.release.href } }
      : {}),
    media: plate ? [plate] : [],
  };
}
