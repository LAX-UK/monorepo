/** Dashboard routes that use compact banner chrome (collapsed alerts button). */
const COMPACT_BANNER_PREFIXES = [
  "/dashboard/watchlist",
  "/dashboard/bids",
  "/dashboard/payments",
  "/dashboard/portfolio",
  "/dashboard/notifications",
  "/dashboard/submissions",
  "/dashboard/seller/in-sale",
  "/dashboard/seller",
  "/dashboard/settings",
  "/dashboard/verify-identity",
  "/dashboard/checkout",
  "/dashboard/organisations",
] as const;

export function isDashboardListRoute(pathname: string): boolean {
  return COMPACT_BANNER_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isDashboardOrgDetailRoute(pathname: string): boolean {
  return /^\/dashboard\/organisations\/[^/]+/.test(pathname);
}
