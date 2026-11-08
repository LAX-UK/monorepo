/**
 * Next's image route can resize a picture to any width in the app's configured lists
 * (`images.deviceSizes` and `images.imageSizes`). A plain `<img>` that is not drawn by
 * `next/image` (a wall of works, a card that crops at a focal point) can still use it by naming
 * the files it wants in a `srcset`, so a small slot is never served the full-size original.
 */

/** The default quality `next/image` uses. */
export const NEXT_IMAGE_QUALITY = 75;

/** A source the image route can serve: a http(s) address or a path on this site. */
function isOptimisable(src: string): boolean {
  if (src.startsWith("/")) return !src.startsWith("//") && !src.endsWith(".svg");
  return /^https?:\/\//i.test(src);
}

/**
 * The `srcset` for `src` at `widths` (each must be one the app allows, or the route refuses it).
 * Widths past the first one that covers the picture's own width (`maxWidth`) are left out: a file
 * larger than the original would not be sharper. Empty when the picture cannot be resized.
 */
export function nextImageSrcSet(
  src: string | null | undefined,
  widths: readonly number[],
  options: { maxWidth?: number | null | undefined; quality?: number } = {},
): string {
  const url = src?.trim();
  if (!url || !isOptimisable(url)) return "";
  const { maxWidth, quality = NEXT_IMAGE_QUALITY } = options;
  const sorted = [...widths].sort((a, b) => a - b);
  const covering = maxWidth ? sorted.findIndex((width) => width >= maxWidth) : -1;
  const used = covering === -1 ? sorted : sorted.slice(0, covering + 1);
  return used
    .map((width) => `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality} ${width}w`)
    .join(", ");
}
