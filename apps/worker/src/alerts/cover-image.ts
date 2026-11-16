/**
 * The widest size of the site's image optimiser that is still light enough for an email: one of
 * the site's own device sizes (640), so it is served from cache, a little over the display width.
 */
export const EMAIL_COVER_SOURCE_WIDTH = 640;

/**
 * The address of a sale's cover picture for an email. The stored original is a print-size file, so
 * the email asks the site's image pipeline (the one the web pages use) for a 640 pixel wide copy.
 * Null when there is nowhere to read the picture from.
 */
export function emailCoverUrl(input: {
  key: string;
  /** Where stored pictures are served from; null when storage has no public address. */
  mediaBaseUrl: string | null;
  /** The Bid site's origin, which serves the image pipeline. */
  siteOrigin: string;
}): string | null {
  const key = input.key.trim();
  if (!key) return null;
  const source = /^https?:\/\//i.test(key)
    ? key
    : input.mediaBaseUrl
      ? `${input.mediaBaseUrl.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`
      : null;
  if (!source) return null;
  const url = new URL("/_next/image", input.siteOrigin);
  url.searchParams.set("url", source);
  url.searchParams.set("w", String(EMAIL_COVER_SOURCE_WIDTH));
  url.searchParams.set("q", "75");
  return url.toString();
}
