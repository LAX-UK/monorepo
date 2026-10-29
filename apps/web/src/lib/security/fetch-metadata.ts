/**
 * Fetch Metadata checks for requests that change state (the account in use, a membership).
 * Browsers say where a request came from in `Sec-Fetch-Site`; a page on another site cannot
 * forge it. See https://www.w3.org/TR/fetch-metadata/ and the OWASP CSRF prevention cheat sheet.
 */

type HeaderReader = Pick<Headers, "get">;

/** `Sec-Fetch-Site`, or `null` from a client that does not send it. */
function fetchSite(headers: HeaderReader): string | null {
  return headers.get("sec-fetch-site")?.trim().toLowerCase() || null;
}

/**
 * A link the person followed on this site, or opened themselves (address bar, bookmark). Only
 * these may change the account by a plain `GET`; a link on another site, or from a client that
 * sends no Fetch Metadata, has to be confirmed first.
 */
export function isSameOriginNavigation(headers: HeaderReader): boolean {
  const site = fetchSite(headers);
  return site === "same-origin" || site === "none";
}

/**
 * A form post or `fetch` from this site's own pages. Browsers without Fetch Metadata are judged
 * by `Origin`, which every browser sends on a cross-origin `POST`.
 */
export function isSameOriginWrite(headers: HeaderReader, expectedOrigin: string): boolean {
  const site = fetchSite(headers);
  if (site) return site === "same-origin";
  return headers.get("origin") === expectedOrigin;
}

/**
 * A speculative request: a router or browser prefetch, not the person asking. It must never
 * change anything, however same-origin it is.
 */
export function isPrefetchRequest(headers: HeaderReader): boolean {
  if (headers.get("next-router-prefetch")) return true;
  const purpose = (headers.get("sec-purpose") ?? headers.get("purpose") ?? "").toLowerCase();
  return purpose.includes("prefetch");
}
