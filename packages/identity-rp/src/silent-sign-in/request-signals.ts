export type HeaderGetter = (name: string) => string | null | undefined;

export function isDocumentNavigation(method: string, getHeader: HeaderGetter): boolean {
  if (method.toUpperCase() !== "GET") return false;
  const mode = getHeader("sec-fetch-mode")?.toLowerCase();
  const dest = getHeader("sec-fetch-dest")?.toLowerCase();
  return mode === "navigate" && dest === "document";
}

export function isPrefetch(getHeader: HeaderGetter): boolean {
  if (getHeader("next-router-prefetch") === "1") return true;
  const purpose = getHeader("sec-purpose") ?? getHeader("purpose");
  return purpose?.toLowerCase().includes("prefetch") ?? false;
}

/** Next.js App Router client prefetch / flight requests (not a full document navigation). */
export function isNextRscRequest(getHeader: HeaderGetter): boolean {
  const rsc = getHeader("rsc");
  return rsc === "1" || rsc === "true";
}

export function isBackgroundAuthRequest(getHeader: HeaderGetter): boolean {
  return isPrefetch(getHeader) || isNextRscRequest(getHeader);
}

const CRAWLER_UA =
  /bot|crawler|spider|slurp|facebookexternalhit|whatsapp|preview|linkedinbot|twitterbot|bingpreview|googlebot|yandex|baidu/i;

export function isLikelyCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return CRAWLER_UA.test(userAgent);
}
