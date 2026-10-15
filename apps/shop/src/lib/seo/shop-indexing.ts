import type { MetadataRoute } from "next";

/** Only the launch host is indexable; test, preview and platform default domains are not. */
export const SHOP_PRODUCTION_HOSTS: ReadonlySet<string> = new Set(["shop.lax.art"]);

export const X_ROBOTS_TAG_NOINDEX = "noindex, nofollow, noarchive";

export const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
} as const;

/** Private, auth and transactional routes stay out of the index. */
export const SHOP_ROBOTS_DISALLOW = [
  "/account",
  "/basket",
  "/checkout",
  "/login",
  "/register",
  "/session-expired",
  "/sign-in-error",
  "/signed-out",
] as const;

export type ShopIndexingOverride = "true" | "false" | undefined;

function normalizeHostname(host: string): string {
  return host.split(":")[0]?.trim().toLowerCase() ?? "";
}

export function isShopIndexingAllowedForHost(
  host: string,
  override: ShopIndexingOverride,
): boolean {
  if (override === "true") return true;
  if (override === "false") return false;
  return SHOP_PRODUCTION_HOSTS.has(normalizeHostname(host));
}

/** Public host behind Cloudflare / App Platform, where `nextUrl.hostname` is the origin host. */
export function publicRequestHost(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("host")?.split(",")[0]?.trim() ?? "";
}

export function composeShopRobots(baseUrl: URL, indexingAllowed: boolean): MetadataRoute.Robots {
  if (!indexingAllowed) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...SHOP_ROBOTS_DISALLOW] },
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
    host: baseUrl.origin,
  };
}
