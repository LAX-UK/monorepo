import type { HomeHeroVm } from "@/lib/home/home-page.vm";
import { nextImageSrcSet } from "@/lib/media/next-image-src-set";
import type {
  CoverMedia,
  CoverPhotoMedia,
  CoverPlateMedia,
  CoverSlide,
} from "@auction/marketing-ui";
import { neutralCoverSlide } from "@auction/marketing-ui";

/** The release's print photograph and the pale field taken from it. */
export type ShopCoverPlate = {
  width: number;
  height: number;
  blurDataURL?: string;
  /** A pale field taken from the print, so the type on it is dark. */
  field: string;
  /** A deep version of the field for the dark theme, where the type turns light. */
  fieldDark: string;
};

/** The plate is drawn at most 600px wide on desktop and 290px on a phone. */
const PLATE_SIZES = "(min-width: 768px) 600px, 290px";

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
    srcSet: nextImageSrcSet(release.imageUrl),
    sizes: PLATE_SIZES,
    width: plate.width,
    height: plate.height,
    ...(plate.blurDataURL ? { blurDataURL: plate.blurDataURL } : {}),
    field: plate.field,
    fieldDark: plate.fieldDark,
    tone: "dark",
  };
}

/** What leads the first screen, in order of preference. */
export type ShopHeroCoverChoice = "staff-photo" | "release-plate" | "type";

/** A staff cover can lead only when it can carry the type: it needs a measured scrim. */
export function isUsableStaffCover(
  cover: CoverPhotoMedia | null | undefined,
): cover is CoverPhotoMedia {
  return Boolean(cover?.slots.default.src && cover.scrim.desktop);
}

/**
 * What leads the first screen: the picture staff chose (with its focal point) when there is one,
 * otherwise the newest edition shown whole at its true ratio beside the headline (the plate), and
 * type only when there is no picture at all. The cover never shows an empty plate: a plate exists
 * only for an edition whose photograph was read.
 */
export function chooseShopHeroCover(input: {
  staffCover?: CoverPhotoMedia | null | undefined;
  plate: CoverPlateMedia | null;
}): ShopHeroCoverChoice {
  if (isUsableStaffCover(input.staffCover)) return "staff-photo";
  return input.plate ? "release-plate" : "type";
}

/**
 * Maps the Shop home hero to the cover. The release leads when it has a photograph (a plate on
 * a pale field); without one the cover is type. With no edition on sale the one way on from
 * the first screen is the action, and with nothing at all the cover says so plainly.
 */
export function toShopCoverSlide(
  hero: HomeHeroVm,
  options: {
    plate: ShopCoverPlate | null;
    catalogueFailed?: boolean;
    /** The picture staff chose for the cover, with its focal point and measured scrim. */
    staffCover?: CoverPhotoMedia | null;
  } = { plate: null },
): CoverSlide {
  if (options.catalogueFailed) return neutralCoverSlide(CATALOGUE_UNAVAILABLE);
  const primary = hero.primary ?? hero.emptyAction;
  if (!primary) return neutralCoverSlide(CATALOGUE_UNAVAILABLE);
  const plate = plateFromRelease(hero.release, options.plate);
  const choice = chooseShopHeroCover({ staffCover: options.staffCover, plate });
  // The staff picture leads; the plate follows so a picture that fails to load falls back to it.
  const media: CoverMedia[] = [
    ...(choice === "staff-photo" && options.staffCover ? [options.staffCover] : []),
    ...(plate ? [plate] : []),
  ];
  return {
    id: "shop-home",
    ...(hero.eyebrow ? { time: hero.eyebrow } : {}),
    title: hero.title,
    fact: hero.lead,
    primary,
    ...(hero.link ? { link: hero.link } : {}),
    ...(hero.release && plate && choice === "release-plate"
      ? { credit: { text: hero.release.line, href: hero.release.href } }
      : {}),
    media,
  };
}
