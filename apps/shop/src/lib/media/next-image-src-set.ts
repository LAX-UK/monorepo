import { nextImageSrcSet as resizedFiles } from "@auction/marketing-ui";

/** Widths Next's image optimiser serves by default; each is a candidate file for the browser. */
const WIDTHS = [256, 384, 640, 828] as const;

/**
 * The resized files Next's image route can make from a picture, as a `srcset`, so a small slot
 * is not served the full-size original. Empty when there is no picture. `maxWidth` is the
 * picture's own width, when known: no file is named that is wider than it needs to be.
 */
export function nextImageSrcSet(src: string, maxWidth?: number | null): string {
  return resizedFiles(src, WIDTHS, { maxWidth });
}
