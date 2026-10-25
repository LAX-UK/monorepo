/** The staff tool's routes: Bid admin lives under `/admin`. */
const STAFF_ROUTE = /^\/admin(?:\/|$)/;

/**
 * Whether the consumer cookie banner belongs on this page. Staff routes are a work tool, not a
 * consumer surface, so the banner and its preferences dialog never render there. Everywhere else
 * it shows as before.
 */
export function showsConsentBanner(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  return !STAFF_ROUTE.test(pathname);
}
