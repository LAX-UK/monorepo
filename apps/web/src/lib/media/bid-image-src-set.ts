import { nextImageSrcSet } from "@auction/marketing-ui";

/*
 * The resized files Bid names for pictures it draws as plain `<img>` (the wall of works, a sale's
 * card, the cover plate). Every width is one `images.deviceSizes` or `images.imageSizes` in
 * `next.config.ts` allows; the image route refuses any other.
 */

/** Cards and works on a wall: from a phone slot to a wide feature card. */
const CARD_WIDTHS = [256, 384, 640, 768, 1024, 1280] as const;

/** Small thumbnails, one to a few dozen pixels across. */
const THUMB_WIDTHS = [64, 96, 128, 192] as const;

/** A cover picture, drawn across the page. */
const COVER_WIDTHS = [640, 768, 1024, 1280, 1536, 1920] as const;

export function bidCardSrcSet(src: string | null | undefined, maxWidth?: number | null): string {
  return nextImageSrcSet(src, CARD_WIDTHS, { maxWidth });
}

export function bidThumbSrcSet(src: string | null | undefined): string {
  return nextImageSrcSet(src, THUMB_WIDTHS);
}

export function bidCoverSrcSet(src: string | null | undefined, maxWidth?: number | null): string {
  return nextImageSrcSet(src, COVER_WIDTHS, { maxWidth });
}
