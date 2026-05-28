/** Dashboard list routes that use compact banner chrome. */
const LIST_ROUTE_PREFIXES = [
  "/dashboard/watchlist",
  "/dashboard/bids",
  "/dashboard/payments",
  "/dashboard/portfolio",
  "/dashboard/notifications",
  "/dashboard/submissions",
  "/dashboard/artist-follow",
  "/dashboard/seller/in-sale",
  "/dashboard/seller",
] as const;

export function isDashboardListRoute(pathname: string): boolean {
  return LIST_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
