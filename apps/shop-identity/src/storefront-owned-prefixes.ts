/** Paths routed to shop-identity on test-shop (mirror auction-infra ingress). */
export const SHOP_IDENTITY_OWNED_PREFIXES = [
  "/login",
  "/logout",
  "/register",
  "/auth",
  "/api",
  "/me",
  "/commerce",
] as const;

export function isShopIdentityOwnedStorefrontPath(pathname: string): boolean {
  for (const prefix of SHOP_IDENTITY_OWNED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

/** Ensures storefront redirects from shop-identity never target identity-owned paths. */
export function assertStorefrontRedirectNotIdentityOwned(location: string): void {
  const pathname = new URL(location).pathname;
  if (isShopIdentityOwnedStorefrontPath(pathname)) {
    throw new Error(`storefront redirect must not target shop-identity path: ${pathname}`);
  }
}
