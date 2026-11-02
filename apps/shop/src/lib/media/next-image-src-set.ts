/** Widths Next's image optimiser serves by default; each is a candidate file for the browser. */
const WIDTHS = [256, 384, 640, 828] as const;
const QUALITY = 75;

/**
 * The resized files Next's image route can make from a picture, as a `srcset`, so a small slot
 * is not served the full-size original. Empty when there is no picture.
 */
export function nextImageSrcSet(src: string): string {
  if (!src) return "";
  return WIDTHS.map(
    (width) => `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${QUALITY} ${width}w`,
  ).join(", ");
}
